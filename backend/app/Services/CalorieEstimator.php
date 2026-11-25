<?php

namespace App\Services;

/**
 * Estimativa de gasto calórico de um treino: kcal = MET × peso (kg) × tempo (h).
 * Valores de MET aproximados do Compendium of Physical Activities (intensidade moderada).
 *
 * - Cardio por tempo ("40 min"): MET da atividade × minutos planejados (se feito).
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

    /**
     * @param  array<int, array{name: string, muscle_group: ?string, sets: int, reps: string, sets_done: int, done: bool}>  $exercises
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
                    $cardioKcal += $this->cardioMet($e['name']) * $weightKg * ($minutes / 60);
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

    private function cardioMet(string $name): float
    {
        $n = \App\Models\Food::normalize($name);
        foreach (self::CARDIO_METS as $key => $met) {
            if (str_contains($n, $key)) {
                return $met;
            }
        }

        return self::CARDIO_DEFAULT_MET;
    }
}
