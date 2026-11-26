<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Workout;
use App\Models\Weight;
use App\Models\WorkoutSession;
use App\Services\CalorieEstimator;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkoutSessionController extends Controller
{
    /** Salva um treino executado (enviado ao finalizar). */
    public function store(Request $request, CalorieEstimator $estimator): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'workout_id' => ['nullable', 'integer'],
            'workout_name' => ['required', 'string', 'max:80'],
            'started_at' => ['required', 'date'],
            'finished_at' => ['required', 'date', 'after_or_equal:started_at'],
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
            'exercises' => array_map(fn ($e) => [
                'name' => $e['name'],
                'muscle_group' => $e['muscle_group'] ?? null,
                'image' => $e['image'] ?? null,
                'sets' => (int) $e['sets'],
                'reps' => $e['reps'],
                'sets_done' => min((int) $e['sets_done'], (int) $e['sets']),
                'done' => (bool) $e['done'],
                'loads' => array_values(array_map(fn ($v) => $v === null ? null : round((float) $v, 1), $e['loads'] ?? [])),
            ], $data['exercises']),
        ]);
        // Estimativa de gasto: peso mais recente até o dia do treino (sem registro → 65 kg)
        $weight = Weight::where('user_id', $user->id)->whereDate('date', '<=', $end->toDateString())->orderByDesc('date')->value('kg');
        $kg = $weight ? (float) $weight : CalorieEstimator::DEFAULT_WEIGHT;
        $session->kcal_burned = $estimator->estimate($session->exercises, $session->duration_seconds, $kg);
        $session->weight_kg = $kg;
        $session->weight_estimated = $weight === null;

        $session->user_id = $user->id;
        $session->save();

        return response()->json(['session' => $session], 201);
    }

    public function show(Request $request, WorkoutSession $session): JsonResponse
    {
        abort_unless($session->user_id === $request->user()->id, 404);

        return response()->json(['session' => $session]);
    }
}
