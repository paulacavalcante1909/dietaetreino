<?php

use App\Models\WorkoutSession;
use App\Services\CalorieEstimator;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Treinos em que o cardio foi feito fora do cronômetro (tempo medido < tempo de cardio):
     * soma o cardio à duração e recalcula as calorias (a musculação estava ficando com 0 kcal).
     */
    public function up(): void
    {
        $estimator = app(CalorieEstimator::class);
        WorkoutSession::query()->chunkById(200, function ($sessions) use ($estimator) {
            foreach ($sessions as $s) {
                $duration = $estimator->effectiveDuration($s->exercises ?? [], (int) $s->duration_seconds);
                if ($duration === (int) $s->duration_seconds) {
                    continue;
                }
                $s->duration_seconds = $duration;
                $s->started_at = $s->finished_at->copy()->subSeconds($duration);
                $s->kcal_burned = $estimator->estimate($s->exercises, $duration, (float) ($s->weight_kg ?: CalorieEstimator::DEFAULT_WEIGHT));
                $s->save();
            }
        });
    }

    public function down(): void
    {
        // Sem volta: a duração anterior estava errada
    }
};
