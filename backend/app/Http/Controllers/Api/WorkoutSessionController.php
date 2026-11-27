<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Checkin;
use App\Models\Weight;
use App\Models\Workout;
use App\Models\WorkoutSession;
use App\Services\CalorieEstimator;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkoutSessionController extends Controller
{
    /** Salva um treino executado (enviado ao finalizar). */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'workout_id' => ['nullable', 'integer'],
            'workout_name' => ['required', 'string', 'max:80'],
            'started_at' => ['required', 'date'],
            'finished_at' => ['required', 'date', 'after_or_equal:started_at'],
            ...self::EXERCISE_RULES,
        ]);

        $workoutId = isset($data['workout_id'])
            ? Workout::where('user_id', $user->id)->whereKey($data['workout_id'])->value('id')
            : null;

        $start = CarbonImmutable::parse($data['started_at'])->setTimezone(config('app.timezone'));
        $end = CarbonImmutable::parse($data['finished_at'])->setTimezone(config('app.timezone'));

        $session = new WorkoutSession([
            'workout_id' => $workoutId,
            'workout_name' => $data['workout_name'],
            'date' => $end->toDateString(),
            'started_at' => $start,
            'finished_at' => $end,
            // Teto de 6 h: protege contra sessão esquecida aberta
            'duration_seconds' => min($end->diffInSeconds($start, true), 6 * 3600),
            'exercises' => $this->normalizeExercises($data['exercises']),
        ]);
        $session->user_id = $user->id;
        $this->estimate($session);
        $session->save();

        return response()->json(['session' => $session], 201);
    }

    /**
     * Para o "Já treinei": os últimos treinos diferentes (para repetir com 1 toque)
     * e quantas vezes cada atividade foi feita nos últimos 60 dias (para ordenar os atalhos).
     */
    public function recent(Request $request): JsonResponse
    {
        $sessions = WorkoutSession::where('user_id', $request->user()->id)
            ->whereDate('date', '>=', now()->subDays(60)->toDateString())
            ->orderByDesc('finished_at')
            ->limit(200)
            ->get();

        $counts = $sessions->countBy(fn (WorkoutSession $s) => self::activityKey($s));
        $recent = $sessions->unique(fn (WorkoutSession $s) => self::activityKey($s))->take(3)
            ->map(fn (WorkoutSession $s) => [...$s->toArray(), 'key' => self::activityKey($s)])
            ->values();

        return response()->json(['recent' => $recent, 'counts' => $counts]);
    }

    /**
     * Registra de novo um treino já feito (mesmos exercícios, duração e km), terminando agora
     * ou ontem neste horário. Desfazer = excluir o novo registro.
     */
    public function repeat(Request $request, WorkoutSession $session): JsonResponse
    {
        abort_unless($session->user_id === $request->user()->id, 404);
        $yesterday = $request->validate(['yesterday' => ['sometimes', 'boolean']])['yesterday'] ?? false;

        $end = CarbonImmutable::now()->subDays($yesterday ? 1 : 0);
        $copy = new WorkoutSession([
            'workout_id' => $session->workout_id,
            'workout_name' => $session->workout_name,
            'date' => $end->toDateString(),
            'started_at' => $end->subSeconds($session->duration_seconds),
            'finished_at' => $end,
            'duration_seconds' => $session->duration_seconds,
            'exercises' => $session->exercises,
        ]);
        $copy->user_id = $session->user_id;
        $this->estimate($copy);
        $copy->save();

        return response()->json(['session' => $copy], 201);
    }

    /** Mesma atividade: o mesmo treino da ficha, ou o mesmo exercício avulso. */
    public static function activityKey(WorkoutSession $s): string
    {
        if ($s->workout_id) {
            return 'w:'.$s->workout_id;
        }

        return count($s->exercises) === 1 ? 'x:'.$s->exercises[0]['name'] : 's:'.$s->workout_name;
    }

    /**
     * Corrige um treino já finalizado: nome, duração e exercícios (séries feitas, cargas, km).
     * O gasto estimado é recalculado.
     */
    public function update(Request $request, WorkoutSession $session): JsonResponse
    {
        abort_unless($session->user_id === $request->user()->id, 404);
        $data = $request->validate([
            'workout_name' => ['required', 'string', 'max:80'],
            'duration_minutes' => ['required', 'integer', 'min:1', 'max:360'],
            ...self::EXERCISE_RULES,
        ], ['duration_minutes.*' => 'Informe a duração em minutos (1 a 360).']);

        $session->fill([
            'workout_name' => $data['workout_name'],
            'duration_seconds' => $data['duration_minutes'] * 60,
            'started_at' => $session->finished_at->subMinutes($data['duration_minutes']),
            'exercises' => $this->normalizeExercises($data['exercises']),
        ]);
        $this->estimate($session);
        $session->save();
        Checkin::where('session_id', $session->id)->update(['workout_name' => $session->workout_name]);

        return response()->json(['session' => $session->load('checkin')]);
    }

    /**
     * Desfaz um treino feito: apaga o registro, as fotos ligadas a ele e, com isso,
     * as calorias gastas daquele dia.
     */
    public function destroy(Request $request, WorkoutSession $session): JsonResponse
    {
        abort_unless($session->user_id === $request->user()->id, 404);

        // Um a um para o evento do model apagar o arquivo da foto
        Checkin::where('session_id', $session->id)->get()->each->delete();
        $session->delete();

        return response()->json(['ok' => true]);
    }

    public function show(Request $request, WorkoutSession $session): JsonResponse
    {
        abort_unless($session->user_id === $request->user()->id, 404);

        return response()->json(['session' => $session->load('checkin')]);
    }

    /** Regras de validação da lista de exercícios de um treino feito. */
    private const EXERCISE_RULES = [
        'exercises' => ['required', 'array', 'min:1', 'max:40'],
        'exercises.*.name' => ['required', 'string', 'max:120'],
        'exercises.*.muscle_group' => ['nullable', 'string', 'max:20'],
        'exercises.*.image' => ['nullable', 'string', 'max:160'],
        'exercises.*.sets' => ['required', 'integer', 'min:1', 'max:10'],
        'exercises.*.reps' => ['required', 'string', 'max:20'],
        'exercises.*.sets_done' => ['required', 'integer', 'min:0', 'max:10'],
        'exercises.*.done' => ['required', 'boolean'],
        'exercises.*.loads' => ['nullable', 'array', 'max:10'],
        'exercises.*.loads.*' => ['nullable', 'numeric', 'min:0', 'max:1000'],
        'exercises.*.distance_km' => ['nullable', 'numeric', 'min:0', 'max:500'],
    ];

    /**
     * @param  list<array<string, mixed>>  $exercises
     * @return list<array{name: string, muscle_group: ?string, image: ?string, sets: int, reps: string, sets_done: int, done: bool, loads: list<?float>, distance_km: ?float}>
     */
    private function normalizeExercises(array $exercises): array
    {
        return array_map(fn (array $e) => [
            'name' => $e['name'],
            'muscle_group' => $e['muscle_group'] ?? null,
            'image' => $e['image'] ?? null,
            'sets' => (int) $e['sets'],
            'reps' => $e['reps'],
            'sets_done' => min((int) $e['sets_done'], (int) $e['sets']),
            'done' => (bool) $e['done'],
            'loads' => array_values(array_map(fn ($v) => $v === null ? null : round((float) $v, 1), $e['loads'] ?? [])),
            'distance_km' => isset($e['distance_km']) && (float) $e['distance_km'] > 0 ? round((float) $e['distance_km'], 2) : null,
        ], array_values($exercises));
    }

    /** Gasto estimado: peso mais recente até o dia do treino (sem registro → 65 kg). */
    private function estimate(WorkoutSession $session): void
    {
        $weight = Weight::where('user_id', $session->user_id)->whereDate('date', '<=', $session->date->toDateString())->orderByDesc('date')->value('kg');
        $kg = $weight ? (float) $weight : CalorieEstimator::DEFAULT_WEIGHT;
        $estimator = app(CalorieEstimator::class);
        // Cardio feito fora do cronômetro entra no tempo total (e a musculação não fica com 0 kcal)
        $duration = $estimator->effectiveDuration($session->exercises, (int) $session->duration_seconds);
        if ($duration !== (int) $session->duration_seconds) {
            $session->duration_seconds = $duration;
            $session->started_at = $session->finished_at->copy()->subSeconds($duration);
        }
        $session->kcal_burned = $estimator->estimate($session->exercises, $session->duration_seconds, $kg);
        $session->weight_kg = $kg;
        $session->weight_estimated = $weight === null;
    }
}
