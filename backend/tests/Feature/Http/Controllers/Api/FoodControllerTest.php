<?php

namespace Tests\Feature\Http\Controllers\Api;

use App\Models\Food;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class FoodControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_food_lists_say_which_foods_are_favorites(): void
    {
        $user = User::factory()->create();
        $rice = $this->food($user, 'Arroz integral');
        $this->food($user, 'Arroz branco');

        $this->actingAs($user)->postJson("/api/foods/{$rice->id}/favorite")->assertOk();

        $foods = collect($this->actingAs($user)->getJson('/api/foods/search?q=arroz')->assertOk()->json('foods'));
        $this->assertTrue($foods->firstWhere('id', $rice->id)['favorite']);
        $this->assertFalse($foods->firstWhere('name', 'Arroz branco')['favorite']);
        $this->actingAs($user)->getJson('/api/foods/favorites')->assertJsonPath('foods.0.favorite', true);
        $this->actingAs($user)->getJson('/api/foods/mine')->assertJsonCount(2, 'foods');
    }

    public function test_recent_also_lists_recently_used_ready_meals_in_order_of_use(): void
    {
        $user = User::factory()->create();
        $rice = $this->food($user, 'Arroz integral');
        $meal = $user->meals()->first();
        $recipe = $this->actingAs($user)->postJson('/api/recipes', [
            'name' => 'Café padrão', 'servings' => 1, 'items' => [['food_id' => $rice->id, 'quantity' => 100, 'portion_id' => null]],
        ])->assertCreated()->json('recipe.id');

        $this->actingAs($user)->postJson('/api/entries', ['date' => '2026-11-25', 'meal_id' => $meal->id, 'food_id' => $rice->id, 'quantity' => 100])->assertCreated();
        $this->actingAs($user)->postJson('/api/entries', ['date' => '2026-11-25', 'meal_id' => $meal->id, 'recipe_id' => $recipe, 'quantity' => 1])->assertCreated();

        $response = $this->actingAs($user)->getJson('/api/foods/recent')
            ->assertJsonCount(1, 'recipes')
            ->assertJsonPath('recipes.0.name', 'Café padrão')
            ->assertJsonPath('recipes.0.last_quantity', 1);
        $this->assertGreaterThan($response->json('foods.0.used_rank'), $response->json('recipes.0.used_rank'));
    }

    private function food(User $user, string $name): Food
    {
        return Food::forceCreate([
            'user_id' => $user->id, 'source' => 'manual', 'name' => $name, 'base_qty' => 100, 'base_unit' => 'g',
            'kcal' => 120, 'carbs' => 25, 'protein' => 3, 'fat' => 1, 'sodium' => 1,
        ]);
    }
}
