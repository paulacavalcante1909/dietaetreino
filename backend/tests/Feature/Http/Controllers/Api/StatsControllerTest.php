<?php

namespace Tests\Feature\Http\Controllers\Api;

use App\Models\Food;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class StatsControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_foods_ranks_what_was_eaten_most_with_its_nutrients(): void
    {
        $this->travelTo('2026-11-25 12:00:00');
        $user = User::factory()->create();
        $meal = $user->meals()->first();
        $bread = $this->food('Pão francês', 300, 58, 8, 3, 650);
        $chicken = $this->food('Frango grelhado', 160, 0, 32, 3, 60);
        $add = fn (string $date, Food $f, float $g) => $this->actingAs($user)->postJson('/api/entries', ['date' => $date, 'meal_id' => $meal->id, 'food_id' => $f->id, 'quantity' => $g])->assertCreated();

        $add('2026-11-24', $bread, 100);
        $add('2026-11-25', $bread, 100);
        $add('2026-11-25', $chicken, 150);
        $add('2026-10-01', $chicken, 150); // fora dos 30 dias

        $this->actingAs($user)->getJson('/api/stats/foods?days=30')
            ->assertOk()
            ->assertJsonPath('logged_days', 2)
            ->assertJsonPath('foods.0.name', 'Pão francês')
            ->assertJsonPath('foods.0.times', 2)
            ->assertJsonPath('foods.0.kcal', 600)
            ->assertJsonPath('foods.1.protein', 48)
            ->assertJsonPath('totals.sodium', 1390);
    }

    private function food(string $name, float $kcal, float $carbs, float $protein, float $fat, float $sodium): Food
    {
        return Food::forceCreate(['source' => 'taco', 'name' => $name, 'base_qty' => 100, 'base_unit' => 'g', 'kcal' => $kcal, 'carbs' => $carbs, 'protein' => $protein, 'fat' => $fat, 'sodium' => $sodium]);
    }
}
