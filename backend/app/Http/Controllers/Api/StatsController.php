<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Checkin;
use App\Models\DiaryEntry;
use App\Models\WorkoutSession;
use App\Services\EnergyEstimator;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StatsController extends Controller
{
    /** Dias com registros num intervalo (faixa da semana na tela inicial). */
    public function calendar(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);
        $uid = $request->user()->id;

        $entries = DiaryEntry::where('user_id', $uid)->whereBetween('date', [$data['from'], $data['to']])
            ->selectRaw('date, COUNT(*) as n')->groupBy('date')->pluck('n', 'date');
        $workouts = WorkoutSession::where('user_id', $uid)->whereBetween('date', [$data['from'], $data['to']])->pluck('date')
            ->merge(Checkin::where('user_id', $uid)->whereBetween('date', [$data['from'], $data['to']])->pluck('date'))
            ->map(fn ($d) => substr((string) $d, 0, 10))->unique()->flip();

        $days = [];
        for ($d = CarbonImmutable::parse($data['from']); $d->lte(CarbonImmutable::parse($data['to'])); $d = $d->addDay()) {
            $k = $d->toDateString();
            $days[$k] = ['entries' => (int) ($entries[$k] ?? $entries[$k.' 00:00:00'] ?? 0), 'workout' => isset($workouts[$k])];
        }

        return response()->json(['days' => $days]);
    }

    /** Resumo de alimentação de uma semana (seg–dom) contra a meta de cada dia. */
    public function week(Request $request, EnergyEstimator $energy): JsonResponse
    {
        $start = CarbonImmutable::parse($request->validate(['start' => ['nullable', 'date_format:Y-m-d']])['start'] ?? 'today')->startOfWeek();
        $user = $request->user();

        $rows = DiaryEntry::where('user_id', $user->id)->whereBetween('date', [$start->toDateString(), $start->endOfWeek()->toDateString()])
            ->selectRaw('date, SUM(kcal) kcal, SUM(carbs) carbs, SUM(protein) protein, SUM(fat) fat, SUM(sodium) sodium, SUM(fiber) fiber')
            ->groupBy('date')->get()->keyBy(fn ($r) => substr((string) $r->date, 0, 10));
        $water = $user->waterLogs()->whereBetween('date', [$start->toDateString(), $start->endOfWeek()->toDateString()])
            ->selectRaw('date, SUM(ml) ml')->groupBy('date')->pluck('ml', 'date')->mapWithKeys(fn ($v, $k) => [substr((string) $k, 0, 10) => (int) $v]);
        $burned = WorkoutSession::where('user_id', $user->id)->whereBetween('date', [$start->toDateString(), $start->endOfWeek()->toDateString()])
            ->selectRaw('date, SUM(kcal_burned) k')->groupBy('date')->pluck('k', 'date')->mapWithKeys(fn ($v, $k) => [substr((string) $k, 0, 10) => (int) $v]);

        $days = [];
        for ($i = 0; $i < 7; $i++) {
            $d = $start->addDays($i)->toDateString();
            $r = $rows->get($d);
            $goal = $user->goalFor($d);
            $days[] = [
                'date' => $d,
                'logged' => (bool) $r,
                'kcal' => round((float) ($r->kcal ?? 0)),
                'carbs' => round((float) ($r->carbs ?? 0), 1),
                'protein' => round((float) ($r->protein ?? 0), 1),
                'fat' => round((float) ($r->fat ?? 0), 1),
                'sodium' => round((float) ($r->sodium ?? 0)),
                'fiber' => round((float) ($r->fiber ?? 0), 1),
                'water' => $water[$d] ?? 0,
                'burned' => $burned[$d] ?? 0,
                'goal' => $goal?->only('kcal', 'kcal_mode', 'carbs_g', 'protein_g', 'fat_g', 'sodium_mg', 'fiber_g', 'water_ml'),
            ];
        }

        // Gasto estimado (GET) por dia registrado, para o déficit da semana
        $energyInfo = null;
        foreach ($days as &$day) {
            $day['get'] = null;
            if ($day['logged'] && $day['date'] <= now()->toDateString()) {
                $e = $energy->forDate($user, $day['date']);
                if ($e['available']) {
                    $day['get'] = $e['get'];
                    $energyInfo = $e;
                } else {
                    $energyInfo ??= $e;
                }
            }
        }
        unset($day);

        return response()->json(['start' => $start->toDateString(), 'days' => $days, 'energy' => $energyInfo ?? $energy->forDate($user, now()->toDateString())]);
    }

    /** Treinos por semana (últimas N semanas): dias treinados, minutos e kcal. */
    /**
     * O que mais pesa na dieta: por alimento (ou refeição pronta), quantas vezes foi registrado
     * e quanto somou de calorias, macros, sódio e fibras no período (7 ou 30 dias, até hoje).
     */
    public function foods(Request $request): JsonResponse
    {
        $days = (int) ($request->validate(['days' => ['sometimes', 'in:7,30']])['days'] ?? 30);
        $from = now()->subDays($days - 1)->toDateString();

        $rows = $request->user()->entries()
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', now()->toDateString())
            ->get(['food_id', 'recipe_id', 'name', 'date', 'kcal', 'carbs', 'protein', 'fat', 'sodium', 'fiber']);

        $sum = fn ($items, string $k) => round((float) $items->sum($k), 1);
        $foods = $rows
            ->groupBy(fn ($e) => $e->recipe_id ? 'r'.$e->recipe_id : ($e->food_id ? 'f'.$e->food_id : 'n'.mb_strtolower($e->name)))
            ->map(fn ($items) => [
                'name' => explode(',', $items->last()->name)[0],
                'times' => $items->count(),
                'days' => $items->pluck('date')->map(fn ($d) => substr((string) $d, 0, 10))->unique()->count(),
                'kcal' => $sum($items, 'kcal'),
                'carbs' => $sum($items, 'carbs'),
                'protein' => $sum($items, 'protein'),
                'fat' => $sum($items, 'fat'),
                'sodium' => $sum($items, 'sodium'),
                'fiber' => $sum($items, 'fiber'),
            ])
            ->sortByDesc('kcal')
            ->take(60)
            ->values();

        return response()->json([
            'days' => $days,
            'logged_days' => $rows->pluck('date')->map(fn ($d) => substr((string) $d, 0, 10))->unique()->count(),
            'foods' => $foods,
            'totals' => collect(['kcal', 'carbs', 'protein', 'fat', 'sodium', 'fiber'])->mapWithKeys(fn ($k) => [$k => $sum($rows, $k)]),
        ]);
    }

    public function workouts(Request $request): JsonResponse
    {
        $weeks = (int) ($request->validate(['weeks' => ['nullable', 'integer', 'min:1', 'max:26']])['weeks'] ?? 8);
        $uid = $request->user()->id;
        $from = CarbonImmutable::today()->startOfWeek()->subWeeks($weeks - 1);

        $sessions = WorkoutSession::where('user_id', $uid)->whereDate('date', '>=', $from->toDateString())->get(['date', 'duration_seconds', 'kcal_burned']);
        $checkinDays = Checkin::where('user_id', $uid)->whereDate('date', '>=', $from->toDateString())->pluck('date')->map(fn ($d) => substr((string) $d, 0, 10));

        $out = [];
        for ($i = 0; $i < $weeks; $i++) {
            $ws = $from->addWeeks($i);
            $we = $ws->endOfWeek();
            $in = fn ($d) => ($d = substr((string) $d, 0, 10)) >= $ws->toDateString() && $d <= $we->toDateString();
            $s = $sessions->filter(fn ($x) => $in($x->date));
            $days = $s->map(fn ($x) => substr((string) $x->date, 0, 10))->merge($checkinDays->filter($in))->unique()->count();
            $out[] = [
                'week_start' => $ws->toDateString(),
                'days' => $days,
                'minutes' => (int) round($s->sum('duration_seconds') / 60),
                'kcal' => (int) $s->sum('kcal_burned'),
            ];
        }

        return response()->json([
            'weeks' => $out,
            'weekly_goal' => (int) $request->user()->weekly_workout_goal,
        ]);
    }

    /**
     * Carga por exercício a partir dos treinos executados.
     * ?names[]=… → última carga usada de cada exercício (para pré-preencher a série)
     * ?name=…    → histórico (maior carga por treino) para o gráfico de evolução
     */
    public function loads(Request $request): JsonResponse
    {
        $data = $request->validate([
            'names' => ['nullable', 'array', 'max:40'],
            'names.*' => ['string', 'max:120'],
            'name' => ['nullable', 'string', 'max:120'],
        ]);
        $sessions = WorkoutSession::where('user_id', $request->user()->id)
            ->orderByDesc('finished_at')->limit(300)->get(['date', 'exercises']);

        if (! empty($data['name'])) {
            $history = [];
            foreach ($sessions as $s) {
                foreach ($s->exercises as $e) {
                    $loads = array_filter($e['loads'] ?? [], fn ($v) => $v !== null && $v > 0);
                    if ($e['name'] === $data['name'] && $loads) {
                        $history[] = ['date' => substr((string) $s->date, 0, 10), 'kg' => max($loads)];
                    }
                }
            }

            return response()->json(['history' => array_reverse($history)]);
        }

        $wanted = array_flip($data['names'] ?? []);
        $last = [];
        foreach ($sessions as $s) {
            foreach ($s->exercises as $e) {
                $loads = array_values(array_filter($e['loads'] ?? [], fn ($v) => $v !== null));
                if (isset($wanted[$e['name']]) && ! isset($last[$e['name']]) && $loads) {
                    $last[$e['name']] = ['date' => substr((string) $s->date, 0, 10), 'loads' => $loads];
                }
            }
        }

        return response()->json(['last' => (object) $last]);
    }
}
