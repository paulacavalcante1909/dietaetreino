<?php

namespace Tests\Feature\Http\Controllers\Api;

use App\Models\Food;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class MealControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_suggestion_brings_the_last_time_the_meal_was_registered(): void
    {
        $user = User::factory()->create();
        $meal = $user->meals()->first();
        $egg = $this->food('Ovo cozido');
        $bread = $this->food('Pão francês');
        $add = fn (string $date, Food $food, float $qty) => $this->actingAs($user)
            ->postJson('/api/entries', ['date' => $date, 'meal_id' => $meal->id, 'food_id' => $food->id, 'quantity' => $qty])->assertCreated();

        $add('2026-11-23', $egg, 100);
        $add('2026-11-24', $egg, 150);
        $add('2026-11-24', $bread, 50);

        $this->actingAs($user)->getJson("/api/meals/{$meal->id}/suggestions?date=2026-11-25")
            ->assertOk()
            ->assertJsonPath('last.date', '2026-11-24')
            ->assertJsonPath('last.items', ['Ovo cozido', 'Pão francês'])
            ->assertJsonMissingPath('frequent');

        // Com qualquer item já registrado na refeição hoje, não sugere repetir
        $add('2026-11-25', $bread, 50);
        $this->actingAs($user)->getJson("/api/meals/{$meal->id}/suggestions?date=2026-11-25")->assertJsonPath('last', null);
    }

    public function test_cannot_see_suggestions_of_another_users_meal(): void
    {
        $meal = User::factory()->create()->meals()->first();

        $this->actingAs(User::factory()->create())->getJson("/api/meals/{$meal->id}/suggestions?date=2026-11-25")->assertNotFound();
    }

    public function test_copying_a_meal_returns_the_new_entries_so_it_can_be_undone(): void
    {
        $user = User::factory()->create();
        $meal = $user->meals()->first();
        $this->actingAs($user)->postJson('/api/entries', ['date' => '2026-11-24', 'meal_id' => $meal->id, 'food_id' => $this->food('Ovo')->id, 'quantity' => 100]);

        $this->actingAs($user)->postJson('/api/entries/copy', ['from_date' => '2026-11-24', 'from_meal_id' => $meal->id, 'to_date' => '2026-11-25', 'to_meal_id' => $meal->id])
            ->assertCreated()
            ->assertJsonCount(1, 'entries')
            ->assertJsonPath('entries.0.date', '2026-11-25');
    }

    public function test_meals_come_with_default_times_that_can_be_changed(): void
    {
        $user = User::factory()->create();
        $breakfast = $user->meals()->first();
        $this->assertSame('07:00', $breakfast->time);

        $this->actingAs($user)->putJson("/api/meals/{$breakfast->id}", ['time' => '06:30'])->assertOk()->assertJsonPath('meal.time', '06:30');
        $this->actingAs($user)->putJson("/api/meals/{$breakfast->id}", ['time' => '6h'])->assertUnprocessable();
        $this->actingAs($user)->postJson('/api/meals', ['name' => 'Pré-treino', 'time' => '17:00'])->assertCreated()->assertJsonPath('meal.time', '17:00');
    }

    private function food(string $name): Food
    {
        return Food::forceCreate(['source' => 'taco', 'name' => $name, 'base_qty' => 100, 'base_unit' => 'g', 'kcal' => 150, 'carbs' => 1, 'protein' => 12, 'fat' => 10, 'sodium' => 100]);
    }
}
