<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Food;
use App\Models\Recipe;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RecipeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // Mais recentes primeiro (último registro no diário); as nunca usadas depois, por nome
        $lastUsed = $request->user()->entries()->whereNotNull('recipe_id')
            ->selectRaw('recipe_id, MAX(id) as last')->groupBy('recipe_id')->pluck('last', 'recipe_id');
        $recipes = Recipe::where('user_id', $request->user()->id)
            ->with('items.food', 'items.portion')
            ->orderBy('name')
            ->get()
            ->sortByDesc(fn (Recipe $r) => (int) ($lastUsed[$r->id] ?? 0))
            ->values()
            ->map->summary();

        return response()->json(['recipes' => $recipes]);
    }

    public function show(Request $request, Recipe $recipe): JsonResponse
    {
        $this->own($request, $recipe);

        return response()->json(['recipe' => $this->detail($recipe)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $recipe = DB::transaction(function () use ($request, $data) {
            $recipe = new Recipe(['name' => $data['name'], 'servings' => $data['servings']]);
            $recipe->user_id = $request->user()->id;
            $recipe->save();
            $this->syncItems($request, $recipe, $data['items']);

            return $recipe;
        });

        return response()->json(['recipe' => $this->detail($recipe)], 201);
    }

    public function update(Request $request, Recipe $recipe): JsonResponse
    {
        $this->own($request, $recipe);
        $data = $this->validated($request);
        DB::transaction(function () use ($request, $recipe, $data) {
            $recipe->update(['name' => $data['name'], 'servings' => $data['servings']]);
            $this->syncItems($request, $recipe, $data['items']);
        });

        return response()->json(['recipe' => $this->detail($recipe->fresh())]);
    }

    public function destroy(Request $request, Recipe $recipe): JsonResponse
    {
        $this->own($request, $recipe);
        $recipe->delete(); // soft delete: registros no diário mantêm o snapshot

        return response()->json(['ok' => true]);
    }

    public function duplicate(Request $request, Recipe $recipe): JsonResponse
    {
        $this->own($request, $recipe);
        $copy = DB::transaction(function () use ($recipe) {
            $copy = $recipe->replicate(['created_at', 'updated_at']);
            $copy->name = mb_substr($recipe->name.' (cópia)', 0, 120);
            $copy->save();
            foreach ($recipe->items as $item) {
                $copy->items()->create($item->only('food_id', 'portion_id', 'quantity', 'position'));
            }

            return $copy;
        });

        return response()->json(['recipe' => $this->detail($copy)], 201);
    }

    private function own(Request $request, Recipe $recipe): void
    {
        abort_unless($recipe->user_id === $request->user()->id, 404);
    }

    private function detail(Recipe $recipe): array
    {
        $recipe->load('items.food.portions', 'items.portion');

        return [
            ...$recipe->summary(),
            'totals' => $recipe->totals(),
            'items' => $recipe->items->map(fn ($i) => [
                'id' => $i->id,
                'food_id' => $i->food_id,
                'portion_id' => $i->portion_id,
                'quantity' => $i->quantity,
                'amount' => $i->amount(),
                'food' => $i->food?->only('id', 'name', 'brand', 'base_qty', 'base_unit', 'kcal', 'carbs', 'protein', 'fat', 'sodium', 'fiber', 'source', 'user_id')
                    + ['portions' => $i->food?->portions ?? [], 'deleted' => (bool) $i->food?->trashed()],
                'nutrients' => $i->food?->nutrientsFor($i->amount()),
            ]),
        ];
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'servings' => ['required', 'numeric', 'gt:0', 'max:100'],
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.food_id' => ['required', 'integer'],
            'items.*.portion_id' => ['nullable', 'integer'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0', 'max:10000'],
        ], [
            'items.required' => 'Adicione pelo menos um ingrediente.',
            'items.min' => 'Adicione pelo menos um ingrediente.',
        ]);
    }

    private function syncItems(Request $request, Recipe $recipe, array $items): void
    {
        $user = $request->user();
        $recipe->items()->delete();
        foreach (array_values($items) as $i => $item) {
            // Aceita alimento já excluído se ele já fazia parte da receita
            $food = Food::withTrashed()->visibleTo($user)->find($item['food_id']);
            if (! $food) {
                throw ValidationException::withMessages(["items.$i.food_id" => 'Alimento não encontrado.']);
            }
            $portionId = $item['portion_id'] ?? null;
            if ($portionId && ! $food->portions()->whereKey($portionId)->exists()) {
                $portionId = null;
            }
            $recipe->items()->create([
                'food_id' => $food->id,
                'portion_id' => $portionId,
                'quantity' => $item['quantity'],
                'position' => $i,
            ]);
        }
        $recipe->touch();
    }
}
