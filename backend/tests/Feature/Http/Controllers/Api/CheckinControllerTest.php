<?php

namespace Tests\Feature\Http\Controllers\Api;

use App\Models\Checkin;
use App\Models\User;
use App\Models\WorkoutSession;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class CheckinControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-25 12:00:00'); // quarta-feira
    }

    public function test_workout_done_in_app_without_checkin_counts_as_training_day(): void
    {
        $user = User::factory()->create();
        $this->appWorkout($user, '2026-11-25');

        $this->actingAs($user)->getJson('/api/checkins?month=2026-11')
            ->assertOk()
            ->assertJsonPath('stats.today', true)
            ->assertJsonPath('stats.streak', 1)
            ->assertJsonPath('stats.week_days', 1)
            ->assertJsonPath('stats.month_count', 1)
            ->assertJsonPath('stats.total_count', 1)
            ->assertJsonCount(1, 'sessions');
    }

    public function test_workout_linked_to_a_checkin_counts_once(): void
    {
        $user = User::factory()->create();
        $session = $this->appWorkout($user, '2026-11-25');
        $this->checkin($user, '2026-11-25', $session->id);

        $this->actingAs($user)->getJson('/api/checkins?month=2026-11')
            ->assertJsonPath('stats.month_count', 1)
            ->assertJsonPath('stats.total_count', 1)
            ->assertJsonCount(1, 'checkins')
            ->assertJsonCount(0, 'sessions');
    }

    public function test_two_checkins_on_the_same_day_count_as_two_workouts_but_one_streak_day(): void
    {
        $user = User::factory()->create();
        $this->checkin($user, '2026-11-25');
        $this->checkin($user, '2026-11-25');

        $this->actingAs($user)->getJson('/api/checkins?month=2026-11')
            ->assertJsonPath('stats.month_count', 2)
            ->assertJsonPath('stats.streak', 1)
            ->assertJsonPath('stats.week_days', 1);
    }

    public function test_streak_joins_checkin_days_and_app_workout_days(): void
    {
        $user = User::factory()->create();
        $this->checkin($user, '2026-11-23');
        $this->appWorkout($user, '2026-11-24');
        $this->checkin($user, '2026-11-25');

        $this->actingAs($user)->getJson('/api/checkins?month=2026-11')->assertJsonPath('stats.streak', 3);
    }

    public function test_history_lists_only_workouts_from_the_requested_month(): void
    {
        $user = User::factory()->create();
        $this->appWorkout($user, '2026-10-31');

        $this->actingAs($user)->getJson('/api/checkins?month=2026-11')->assertJsonCount(0, 'sessions');
    }

    private function appWorkout(User $user, string $date): WorkoutSession
    {
        return WorkoutSession::forceCreate([
            'user_id' => $user->id, 'workout_name' => 'Treino A', 'date' => $date,
            'started_at' => $date.' 10:00:00', 'finished_at' => $date.' 11:00:00', 'duration_seconds' => 3600,
            'exercises' => [], 'kcal_burned' => 300,
        ]);
    }

    private function checkin(User $user, string $date, ?int $sessionId = null): void
    {
        Checkin::forceCreate(['user_id' => $user->id, 'date' => $date, 'workout_name' => 'Treino A', 'session_id' => $sessionId]);
    }
}
