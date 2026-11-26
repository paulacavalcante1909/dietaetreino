<?php

namespace Tests\Feature\Http\Controllers\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class GoalControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    private const GOAL = ['kcal' => 1800, 'carbs_g' => 180, 'protein_g' => 130, 'fat_g' => 60, 'sodium_mg' => 2000, 'water_ml' => 2500];

    public function test_saves_fiber_goal(): void
    {
        $this->actingAs(User::factory()->create())->postJson('/api/goals', [...self::GOAL, 'fiber_g' => 30])
            ->assertOk()
            ->assertJsonPath('goal.fiber_g', 30);
    }

    public function test_fiber_goal_defaults_to_25_grams_when_omitted(): void
    {
        $this->actingAs(User::factory()->create())->postJson('/api/goals', self::GOAL)
            ->assertOk()
            ->assertJsonPath('goal.fiber_g', 25);
    }

    public function test_rejects_fiber_goal_above_200_grams_with_422(): void
    {
        $this->actingAs(User::factory()->create())->postJson('/api/goals', [...self::GOAL, 'fiber_g' => 201])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('fiber_g');
    }

    public function test_goal_keeps_how_the_day_counts_for_calories(): void
    {
        $user = User::factory()->create();
        $base = ['kcal' => 2500, 'carbs_g' => 300, 'protein_g' => 150, 'fat_g' => 70, 'sodium_mg' => 2000, 'water_ml' => 3000];

        $this->actingAs($user)->postJson('/api/goals', [...$base, 'kcal_mode' => 'min'])->assertOk()->assertJsonPath('goal.kcal_mode', 'min');
        $this->actingAs($user)->postJson('/api/goals', [...$base, 'kcal_mode' => 'menos'])->assertUnprocessable();
    }
}
