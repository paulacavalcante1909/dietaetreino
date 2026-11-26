<?php

namespace Tests\Feature\Http\Controllers\Api;

use App\Models\Checkin;
use App\Models\User;
use App\Models\WorkoutSession;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class WorkoutSessionControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-25 12:00:00');
        Storage::fake('local');
    }

    public function test_undoing_a_workout_removes_it_with_its_photo_and_burned_calories(): void
    {
        $user = User::factory()->create();
        $session = $this->appWorkout($user, '2026-11-25');
        Storage::disk('local')->put('checkins/1/foto.jpg', 'x');
        Checkin::forceCreate(['user_id' => $user->id, 'date' => '2026-11-25', 'workout_name' => 'Treino A', 'session_id' => $session->id, 'photo_path' => 'checkins/1/foto.jpg']);

        $this->actingAs($user)->getJson('/api/day/2026-11-25')->assertJsonPath('burned', 300)->assertJsonCount(1, 'trainings');

        $this->actingAs($user)->deleteJson("/api/workout-sessions/{$session->id}")->assertOk();

        $this->assertModelMissing($session);
        $this->assertSame(0, Checkin::count());
        Storage::disk('local')->assertMissing('checkins/1/foto.jpg');
        $this->actingAs($user)->getJson('/api/day/2026-11-25')->assertJsonPath('burned', 0)->assertJsonCount(0, 'trainings');
        $this->actingAs($user)->getJson('/api/checkins?month=2026-11')->assertJsonPath('stats.total_count', 0);
    }

    public function test_cannot_undo_another_users_workout(): void
    {
        $session = $this->appWorkout(User::factory()->create(), '2026-11-25');

        $this->actingAs(User::factory()->create())->deleteJson("/api/workout-sessions/{$session->id}")->assertNotFound();

        $this->assertModelExists($session);
    }

    public function test_photo_added_to_a_registered_workout_uses_the_workout_date(): void
    {
        $user = User::factory()->create();
        $session = $this->appWorkout($user, '2026-11-24');

        $this->actingAs($user)->post('/api/checkins', [
            'session_id' => $session->id,
            'photo' => UploadedFile::fake()->image('foto.jpg', 40, 40),
        ], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('checkin.date', '2026-11-24');
    }

    public function test_day_lists_workouts_with_photo_and_old_checkins_without_workout(): void
    {
        $user = User::factory()->create();
        $session = $this->appWorkout($user, '2026-11-25');
        Checkin::forceCreate(['user_id' => $user->id, 'date' => '2026-11-25', 'workout_name' => 'Treino B']);

        $this->actingAs($user)->getJson('/api/day/2026-11-25')
            ->assertJsonCount(2, 'trainings')
            ->assertJsonPath('trainings.0.session_id', $session->id)
            ->assertJsonPath('trainings.0.kcal', 300)
            ->assertJsonPath('trainings.1.session_id', null)
            ->assertJsonPath('trainings.1.name', 'Treino B');
    }

    private function appWorkout(User $user, string $date): WorkoutSession
    {
        return WorkoutSession::forceCreate([
            'user_id' => $user->id, 'workout_name' => 'Treino A', 'date' => $date,
            'started_at' => $date.' 10:00:00', 'finished_at' => $date.' 11:00:00', 'duration_seconds' => 3600,
            'exercises' => [], 'kcal_burned' => 300,
        ]);
    }
}
