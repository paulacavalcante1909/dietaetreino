<?php

namespace Tests\Feature\Http\Controllers\Api;

use App\Models\Exercise;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class ExerciseControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_favorite_exercises_come_first_and_have_their_own_filter(): void
    {
        $user = User::factory()->create();
        Exercise::create(['name' => 'Agachamento', 'muscle_group' => 'quadriceps']);
        $plank = Exercise::create(['name' => 'Prancha', 'muscle_group' => 'abdomen']);

        $this->actingAs($user)->postJson("/api/exercises/{$plank->id}/favorite")->assertOk();

        $this->actingAs($user)->getJson('/api/exercises')
            ->assertJsonPath('exercises.0.name', 'Prancha')
            ->assertJsonPath('exercises.0.favorite', true)
            ->assertJsonPath('exercises.1.favorite', false);
        $this->actingAs($user)->getJson('/api/exercises?group=favoritos')
            ->assertJsonCount(1, 'exercises');

        $this->actingAs($user)->deleteJson("/api/exercises/{$plank->id}/favorite")->assertOk();
        $this->actingAs($user)->getJson('/api/exercises?group=favoritos')->assertJsonCount(0, 'exercises');
    }

    public function test_cannot_favorite_another_users_custom_exercise(): void
    {
        $other = Exercise::forceCreate(['name' => 'Meu', 'muscle_group' => 'abdomen', 'user_id' => User::factory()->create()->id]);

        $this->actingAs(User::factory()->create())->postJson("/api/exercises/{$other->id}/favorite")->assertNotFound();
    }
}
