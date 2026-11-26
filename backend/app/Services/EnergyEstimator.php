<?php

namespace App\Services;

use App\Models\User;
use App\Models\Weight;
use Carbon\CarbonImmutable;

/**
 * Gasto energético estimado e déficit calórico.
 *
 * TMB (Mifflin-St Jeor): 10 × peso + 6,25 × altura − 5 × idade − 161 (mulheres) | + 5 (homens).
 * GET = TMB × fator de atividade. O fator vem da frequência de dias treinados (check-in ou treino no app) (média por semana
 * nas últimas 4 semanas, ou desde a criação da conta, se for mais recente).
 * Déficit = GET − calorias consumidas no dia. O gasto dos treinos NÃO é somado de novo,
 * porque já está embutido no fator de atividade.
 */
class EnergyEstimator
{
    private const WINDOW_DAYS = 28;

    /** [mínimo de dias treinados por semana, fator, nome] */
    private const LEVELS = [
        [6.5, 1.9, 'Extremamente ativo'],
        [5.0, 1.725, 'Muito ativo'],
        [3.0, 1.55, 'Moderadamente ativo'],
        [1.0, 1.375, 'Levemente ativo'],
        [0.0, 1.2, 'Sedentário'],
    ];

    /**
     * Dados do gasto para uma data. Sem perfil completo, devolve só o que falta.
     *
     * @return array{available: false, missing: list<'sex'|'birth_date'|'height_cm'|'weight'>}|array{available: true, missing: array{}, weight: float, height_cm: int, age: int, sex: 'f'|'m', tmb: int, factor: float, level: string, checkins_per_week: float, window_days: int, get: int}
     */
    public function forDate(User $user, string $date): array
    {
        $day = CarbonImmutable::parse($date);
        $weight = Weight::where('user_id', $user->id)->whereDate('date', '<=', $date)->orderByDesc('date')->value('kg')
            ?? Weight::where('user_id', $user->id)->orderBy('date')->value('kg'); // dia antes do 1º registro: usa o 1º

        $missing = [];
        if (! in_array($user->sex, ['f', 'm'], true)) {
            $missing[] = 'sex';
        }
        if (! $user->birth_date) {
            $missing[] = 'birth_date';
        }
        if (! $user->height_cm) {
            $missing[] = 'height_cm';
        }
        if (! $weight) {
            $missing[] = 'weight';
        }
        if ($missing) {
            return ['available' => false, 'missing' => $missing];
        }

        $age = (int) CarbonImmutable::parse($user->birth_date)->diffInYears($day);
        $tmb = 10 * $weight + 6.25 * $user->height_cm - 5 * $age + ($user->sex === 'm' ? 5 : -161);

        [$perWeek, $windowDays] = $this->checkinsPerWeek($user, $day);
        [, $factor, $level] = collect(self::LEVELS)->first(fn ($l) => $perWeek >= $l[0]);

        return [
            'available' => true,
            'missing' => [],
            'weight' => round((float) $weight, 1),
            'height_cm' => (int) $user->height_cm,
            'age' => $age,
            'sex' => $user->sex,
            'tmb' => (int) round($tmb),
            'factor' => $factor,
            'level' => $level,
            'checkins_per_week' => round($perWeek, 1),
            'window_days' => $windowDays,
            'get' => (int) round($tmb * $factor),
        ];
    }

    /**
     * Média de dias treinados por semana até a data (janela de até 4 semanas).
     *
     * @return array{float, int} [check-ins por semana, dias da janela]
     */
    private function checkinsPerWeek(User $user, CarbonImmutable $day): array
    {
        $since = CarbonImmutable::parse($user->created_at)->startOfDay();
        $window = (int) min(self::WINDOW_DAYS, max(7, $since->diffInDays($day->startOfDay()) + 1));
        $from = $day->subDays($window - 1)->toDateString();

        $days = app(TrainingLog::class)->dates($user->id, $from, $day->toDateString())->count();

        return [$days * 7 / $window, $window];
    }
}
