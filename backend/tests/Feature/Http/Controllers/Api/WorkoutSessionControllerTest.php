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

    public function test_finished_workout_can_be_edited_and_calories_are_recalculated(): void
    {
        $user = User::factory()->create();
        $session = $this->appWorkout($user, '2026-11-25');

        $this->actingAs($user)->putJson("/api/workout-sessions/{$session->id}", [
            'workout_name' => 'Corrida de sábado',
            'duration_minutes' => 60,
            'exercises' => [['name' => 'Corrida', 'sets' => 1, 'reps' => '60 min', 'sets_done' => 1, 'done' => true, 'distance_km' => 10]],
        ])->assertOk()
            ->assertJsonPath('session.workout_name', 'Corrida de sábado')
            ->assertJsonPath('session.duration_seconds', 3600)
            ->assertJsonPath('session.exercises.0.distance_km', 10)
            // ACSM: 10 km em 60 min, 65 kg (sem peso registrado) ≈ 718 kcal
            ->assertJsonPath('session.kcal_burned', 718);
    }

    public function test_cannot_edit_another_users_workout(): void
    {
        $session = $this->appWorkout(User::factory()->create(), '2026-11-25');

        $this->actingAs(User::factory()->create())->putJson("/api/workout-sessions/{$session->id}", [
            'workout_name' => 'x', 'duration_minutes' => 10,
            'exercises' => [['name' => 'Corrida', 'sets' => 1, 'reps' => '10 min', 'sets_done' => 1, 'done' => true]],
        ])->assertNotFound();
    }

    public function test_sending_a_new_photo_replaces_the_workouts_photo(): void
    {
        $user = User::factory()->create();
        $session = $this->appWorkout($user, '2026-11-25');
        $send = fn (array $data) => $this->actingAs($user)->post('/api/checkins', ['session_id' => $session->id, ...$data], ['Accept' => 'application/json']);

        $send(['photo' => UploadedFile::fake()->image('a.jpg', 40, 40), 'note' => 'boa'])->assertCreated();
        $send(['photo' => UploadedFile::fake()->image('b.jpg', 40, 40)])->assertOk()->assertJsonPath('checkin.note', 'boa');

        $this->assertSame(1, Checkin::count());
        $this->assertCount(1, Storage::disk('local')->allFiles());

        $send(['remove_photo' => 1])->assertOk()->assertJsonPath('checkin.photo_url', null)->assertJsonPath('checkin.note', 'boa');
        $this->assertCount(0, Storage::disk('local')->allFiles());
    }

    public function test_recent_lists_distinct_activities_with_how_often_they_were_done(): void
    {
        $user = User::factory()->create();
        $this->outdoorRun($user, '2026-11-20', 5);
        $this->outdoorRun($user, '2026-11-22', 6);
        $this->appWorkout($user, '2026-11-24');

        $this->actingAs($user)->getJson('/api/workout-sessions/recent')
            ->assertJsonCount(2, 'recent')
            ->assertJsonPath('recent.0.workout_name', 'Treino A')
            ->assertJsonPath('recent.1.exercises.0.distance_km', 6)
            ->assertJsonPath('counts.x:Corrida', 2);
    }

    public function test_repeating_a_workout_registers_a_copy_for_today_or_yesterday(): void
    {
        $user = User::factory()->create();
        $run = $this->outdoorRun($user, '2026-11-20', 5);

        $this->actingAs($user)->postJson("/api/workout-sessions/{$run->id}/repeat")
            ->assertCreated()
            ->assertJsonPath('session.date', '2026-11-25')
            ->assertJsonPath('session.duration_seconds', 1800)
            ->assertJsonPath('session.exercises.0.distance_km', 5);
        $this->actingAs($user)->postJson("/api/workout-sessions/{$run->id}/repeat", ['yesterday' => true])
            ->assertJsonPath('session.date', '2026-11-24');

        $this->actingAs(User::factory()->create())->postJson("/api/workout-sessions/{$run->id}/repeat")->assertNotFound();
    }

    private function outdoorRun(User $user, string $date, float $km): WorkoutSession
    {
        return WorkoutSession::forceCreate([
            'user_id' => $user->id, 'workout_name' => 'Corrida', 'date' => $date,
            'started_at' => $date.' 07:00:00', 'finished_at' => $date.' 07:30:00', 'duration_seconds' => 1800,
            'exercises' => [['name' => 'Corrida', 'muscle_group' => 'cardio', 'image' => null, 'sets' => 1, 'reps' => '30 min', 'sets_done' => 1, 'done' => true, 'loads' => [], 'distance_km' => $km]],
            'kcal_burned' => 300,
        ]);
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
