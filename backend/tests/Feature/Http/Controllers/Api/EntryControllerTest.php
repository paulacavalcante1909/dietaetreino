<?php

namespace Tests\Feature\Http\Controllers\Api;

use App\Models\Food;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class EntryControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_entry_from_food_stores_fiber_for_the_logged_amount(): void
    {
        $user = User::factory()->create();
        $food = $this->food(fiberPer100g: 2.7);

        $this->actingAs($user)->postJson('/api/entries', $this->entryPayload($user, $food, grams: 200))
            ->assertCreated()
            ->assertJsonPath('entry.fiber', 5.4);
    }

    public function test_food_without_fiber_information_logs_zero_fiber(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/entries', $this->entryPayload($user, $this->food(fiberPer100g: null), grams: 150))
            ->assertCreated()
            ->assertJsonPath('entry.fiber', 0);
    }

    public function test_changing_quantity_of_entry_with_deleted_food_scales_fiber(): void
    {
        $user = User::factory()->create();
        $food = $this->food(fiberPer100g: 2.7);
        $entryId = $this->actingAs($user)->postJson('/api/entries', $this->entryPayload($user, $food, grams: 200))->json('entry.id');
        $food->delete();

        $this->actingAs($user)->putJson("/api/entries/{$entryId}", ['quantity' => 100])
            ->assertOk()
            ->assertJsonPath('entry.fiber', 2.7);
    }

    public function test_recipe_entry_stores_fiber_per_serving(): void
    {
        $user = User::factory()->create();
        $recipeId = $this->actingAs($user)->postJson('/api/recipes', [
            'name' => 'Arroz e feijão',
            'servings' => 2,
            'items' => [
                ['food_id' => $this->food(fiberPer100g: 2.7)->id, 'quantity' => 200],
                ['food_id' => $this->food(fiberPer100g: 8.5)->id, 'quantity' => 100],
            ],
        ])->assertCreated()->json('recipe.id');

        $this->actingAs($user)->postJson('/api/entries', [
            'date' => '2026-11-25', 'meal_id' => $user->meals()->value('id'), 'recipe_id' => $recipeId, 'quantity' => 1,
        ])
            ->assertCreated()
            ->assertJsonPath('entry.fiber', 7); // (5,4 + 8,5) / 2 porções = 6,95 → 7,0
    }

    private function food(?float $fiberPer100g): Food
    {
        return Food::forceCreate([
            'source' => 'taco', 'name' => 'Alimento teste', 'search_name' => 'alimento teste', 'base_qty' => 100, 'base_unit' => 'g',
            'kcal' => 100, 'carbs' => 0, 'protein' => 0, 'fat' => 0, 'sodium' => 0, 'fiber' => $fiberPer100g,
        ]);
    }

    /** @return array{date: string, meal_id: int, food_id: int, quantity: float} */
    private function entryPayload(User $user, Food $food, float $grams): array
    {
        return ['date' => '2026-11-25', 'meal_id' => $user->meals()->value('id'), 'food_id' => $food->id, 'quantity' => $grams];
    }
}
