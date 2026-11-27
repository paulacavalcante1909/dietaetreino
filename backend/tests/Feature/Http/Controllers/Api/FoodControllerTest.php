<?php

namespace Tests\Feature\Http\Controllers\Api;

use App\Models\Food;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Cache;
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

    public function test_recent_can_be_limited_to_one_meal(): void
    {
        $user = User::factory()->create();
        [$breakfast, , , , $dinner] = $user->meals()->get()->all();
        $bread = $this->food($user, 'Pão francês');
        $rice = $this->food($user, 'Arroz integral');
        $this->actingAs($user)->postJson('/api/entries', ['date' => '2026-11-25', 'meal_id' => $breakfast->id, 'food_id' => $bread->id, 'quantity' => 50])->assertCreated();
        $this->actingAs($user)->postJson('/api/entries', ['date' => '2026-11-25', 'meal_id' => $dinner->id, 'food_id' => $rice->id, 'quantity' => 150])->assertCreated();

        $this->actingAs($user)->getJson("/api/foods/recent?meal_id={$breakfast->id}")
            ->assertJsonCount(1, 'foods')
            ->assertJsonPath('foods.0.name', 'Pão francês');
        $this->actingAs($user)->getJson('/api/foods/recent')->assertJsonCount(2, 'foods');
        $other = User::factory()->create()->meals()->first();
        $this->actingAs($user)->getJson("/api/foods/recent?meal_id={$other->id}")->assertUnprocessable();
    }

    public function test_common_foods_come_from_the_base_for_first_uses(): void
    {
        $rice = Food::forceCreate(['source' => 'taco', 'name' => 'Arroz, tipo 1, cozido', 'base_qty' => 100, 'base_unit' => 'g', 'kcal' => 128, 'carbs' => 28, 'protein' => 2.5, 'fat' => 0.2, 'sodium' => 1]);
        Cache::forget('foods.common.v1');

        $this->actingAs(User::factory()->create())->getJson('/api/foods/common')
            ->assertOk()
            ->assertJsonPath('foods.0.id', $rice->id);
    }

    public function test_ready_meals_are_listed_most_recently_used_first(): void
    {
        $user = User::factory()->create();
        $rice = $this->food($user, 'Arroz integral');
        $make = fn (string $name) => $this->actingAs($user)->postJson('/api/recipes', ['name' => $name, 'servings' => 1, 'items' => [['food_id' => $rice->id, 'quantity' => 100, 'portion_id' => null]]])->json('recipe.id');
        $a = $make('A café');
        $b = $make('B almoço');
        $make('C nunca usada');
        $meal = $user->meals()->first();
        $this->actingAs($user)->postJson('/api/entries', ['date' => '2026-11-24', 'meal_id' => $meal->id, 'recipe_id' => $a, 'quantity' => 1]);
        $this->actingAs($user)->postJson('/api/entries', ['date' => '2026-11-25', 'meal_id' => $meal->id, 'recipe_id' => $b, 'quantity' => 1]);

        $names = collect($this->actingAs($user)->getJson('/api/recipes')->json('recipes'))->pluck('name')->all();
        $this->assertSame(['B almoço', 'A café', 'C nunca usada'], $names);
    }

    private function food(User $user, string $name): Food
    {
        return Food::forceCreate([
            'user_id' => $user->id, 'source' => 'manual', 'name' => $name, 'base_qty' => 100, 'base_unit' => 'g',
            'kcal' => 120, 'carbs' => 25, 'protein' => 3, 'fat' => 1, 'sodium' => 1,
        ]);
    }
}
