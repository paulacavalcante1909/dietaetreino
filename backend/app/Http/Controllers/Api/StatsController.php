<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Checkin;
use App\Models\DiaryEntry;
use App\Models\WorkoutSession;
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
    public function week(Request $request): JsonResponse
    {
        $start = CarbonImmutable::parse($request->validate(['start' => ['nullable', 'date_format:Y-m-d']])['start'] ?? 'today')->startOfWeek();
        $user = $request->user();

        $rows = DiaryEntry::where('user_id', $user->id)->whereBetween('date', [$start->toDateString(), $start->endOfWeek()->toDateString()])
            ->selectRaw('date, SUM(kcal) kcal, SUM(carbs) carbs, SUM(protein) protein, SUM(fat) fat, SUM(sodium) sodium')
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
                'water' => $water[$d] ?? 0,
                'burned' => $burned[$d] ?? 0,
                'goal' => $goal?->only('kcal', 'carbs_g', 'protein_g', 'fat_g', 'sodium_mg', 'water_ml'),
            ];
        }

        return response()->json(['start' => $start->toDateString(), 'days' => $days]);
    }

    /** Treinos por semana (últimas N semanas): dias treinados, minutos e kcal. */
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
