<?php

namespace App\Services;

use App\Models\Checkin;
use App\Models\WorkoutSession;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Regras únicas de "treinou": um dia conta como treinado se tem check-in OU treino feito no app.
 * Um treino ligado a um check-in conta uma vez só (o check-in representa o treino).
 */
class TrainingLog
{
    /**
     * Datas distintas (Y-m-d) com treino, em ordem decrescente.
     *
     * @return Collection<int, string>
     */
    public function dates(int $userId, ?string $from = null, ?string $to = null): Collection
    {
        $checkins = $this->range(Checkin::where('user_id', $userId), $from, $to)->pluck('date');
        $sessions = $this->range(WorkoutSession::where('user_id', $userId), $from, $to)->pluck('date');

        return $checkins->merge($sessions)
            ->map(fn ($date): string => substr((string) $date, 0, 10))
            ->unique()->sortDesc()->values();
    }

    /** Treinos registrados: todos os check-ins + treinos feitos no app que não viraram check-in. */
    public function count(int $userId, ?string $from = null, ?string $to = null): int
    {
        return $this->range(Checkin::where('user_id', $userId), $from, $to)->count()
            + $this->range($this->sessionsWithoutCheckin($userId), $from, $to)->count();
    }

    /**
     * Treinos feitos no app sem check-in ligado.
     *
     * @return Builder<WorkoutSession>
     */
    public function sessionsWithoutCheckin(int $userId): Builder
    {
        return WorkoutSession::where('user_id', $userId)
            ->whereNotIn('id', Checkin::where('user_id', $userId)->whereNotNull('session_id')->select('session_id'));
    }

    /**
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    private function range(Builder $query, ?string $from, ?string $to): Builder
    {
        if ($from !== null) {
            $query->whereDate('date', '>=', $from);
        }
        if ($to !== null) {
            $query->whereDate('date', '<=', $to);
        }

        return $query;
    }
}
