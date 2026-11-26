<?php

namespace App\Services;

use App\Models\Food;

/**
 * Estimativa de gasto calórico de um treino: kcal = MET × peso (kg) × tempo (h).
 * Valores de MET aproximados do Compendium of Physical Activities (intensidade moderada).
 *
 * - Cardio por tempo ("40 min"): MET da atividade × minutos planejados (se feito).
 * - Cardio com distância (km) e tempo: usa a velocidade.
 *   - Caminhada/corrida: equações metabólicas do ACSM (terreno plano):
 *     VO2 (ml/kg/min) = 3,5 + 0,1 × v (caminhada, < 7 km/h) ou 3,5 + 0,2 × v (corrida), v em m/min;
 *     kcal = VO2 × peso × minutos ÷ 200  (≈ 1 kcal por kg por km correndo).
 *   - Bicicleta: MET pela velocidade média (Compendium): < 16 km/h 4,0; < 19 6,8; < 22,5 8,0; < 25,7 10,0; < 30,6 12,0; acima 15,8.
 * - Musculação: MET 5,0 × o restante do tempo do treino (inclui descansos).
 * É uma MÉDIA: o gasto real varia com idade, condicionamento e intensidade.
 */
class CalorieEstimator
{
    public const DEFAULT_WEIGHT = 65.0;

    private const STRENGTH_MET = 5.0;

    private const CARDIO_DEFAULT_MET = 7.0;

    /** Palavra-chave no nome do exercício => MET */
    private const CARDIO_METS = [
        'corrida' => 8.3,
        'caminhada' => 3.5,
        'bicicleta' => 6.8,
        'bike' => 6.8,
        'eliptico' => 5.0,
        'escada' => 9.0,
        'stairmaster' => 9.0,
        'remo' => 7.0,
        'pular corda' => 11.0,
        'polichinelo' => 8.0,
        'salto' => 8.0,
    ];

    private const FOOT_WORDS = ['corrida', 'correr', 'caminhada', 'caminhar', 'trote', 'esteira', 'trilha'];

    private const BIKE_WORDS = ['bicicleta', 'bike', 'ciclismo', 'pedal', 'spinning'];

    /** [velocidade máxima em km/h, MET] */
    private const BIKE_METS = [[16, 4.0], [19, 6.8], [22.5, 8.0], [25.7, 10.0], [30.6, 12.0], [PHP_INT_MAX, 15.8]];

    /**
     * @param  array<int, array{name: string, muscle_group: ?string, sets: int, reps: string, sets_done: int, done: bool, distance_km?: ?float}>  $exercises
     */
    public function estimate(array $exercises, int $durationSeconds, float $weightKg): int
    {
        $cardioKcal = 0.0;
        $cardioSeconds = 0;
        $hasStrength = false;

        foreach ($exercises as $e) {
            $minutes = $this->timedMinutes($e);
            if ($minutes !== null) {
                if ($e['done']) {
                    $cardioSeconds += $minutes * 60;
                    $cardioKcal += $this->cardioKcal($e['name'], $minutes, (float) ($e['distance_km'] ?? 0), $weightKg);
                }
            } elseif ($e['sets_done'] > 0) {
                $hasStrength = true;
            }
        }

        $strengthSeconds = $hasStrength ? max(0, $durationSeconds - $cardioSeconds) : 0;
        $strengthKcal = self::STRENGTH_MET * $weightKg * ($strengthSeconds / 3600);

        return (int) round($cardioKcal + $strengthKcal);
    }

    /** "40 min" com 1 série = exercício por tempo */
    private function timedMinutes(array $e): ?int
    {
        return ((int) $e['sets'] === 1 && preg_match('/^(\d{1,3})\s*min$/i', trim($e['reps']), $m)) ? (int) $m[1] : null;
    }

    /** Gasto de um cardio: pela velocidade quando há distância; senão pelo MET médio da atividade. */
    public function cardioKcal(string $name, int $minutes, float $km, float $weightKg): float
    {
        $n = Food::normalize($name);
        if ($km > 0 && $minutes > 0) {
            $kmh = $km / ($minutes / 60);
            if ($this->matches($n, self::FOOT_WORDS)) {
                $metersPerMinute = min($kmh, 25) * 1000 / 60;
                $vo2 = 3.5 + ($kmh < 7 ? 0.1 : 0.2) * $metersPerMinute;

                return $vo2 * $weightKg * $minutes / 200;
            }
            if ($this->matches($n, self::BIKE_WORDS)) {
                foreach (self::BIKE_METS as [$max, $met]) {
                    if ($kmh < $max) {
                        return $met * $weightKg * ($minutes / 60);
                    }
                }
            }
        }

        return $this->cardioMet($name) * $weightKg * ($minutes / 60);
    }

    /** @param  list<string>  $words */
    private function matches(string $normalized, array $words): bool
    {
        foreach ($words as $w) {
            if (str_contains($normalized, $w)) {
                return true;
            }
        }

        return false;
    }

    private function cardioMet(string $name): float
    {
        $n = Food::normalize($name);
        foreach (self::CARDIO_METS as $key => $met) {
            if (str_contains($n, $key)) {
                return $met;
            }
        }

        return self::CARDIO_DEFAULT_MET;
    }
}
