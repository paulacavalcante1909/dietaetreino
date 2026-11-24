<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DiaryEntry;
use App\Models\Food;
use App\Models\FoodPortion;
use App\Models\Recipe;
use App\Models\RecipeItem;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class EntryController extends Controller
{
    /** Adiciona um alimento (food_id) OU uma receita (recipe_id, quantity = porções). */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
            'meal_id' => ['required', Rule::exists('meals', 'id')->where('user_id', $user->id)],
            'food_id' => ['required_without:recipe_id', 'nullable', 'integer'],
            'recipe_id' => ['required_without:food_id', 'nullable', 'integer'],
            'quantity' => ['required', 'numeric', 'gt:0', 'max:10000'],
            'portion_id' => ['nullable', 'integer'],
            // Ingredientes ajustados só para este registro (opcional, apenas com recipe_id)
            'items' => ['nullable', 'array', 'min:1', 'max:50'],
            'items.*.food_id' => ['required', 'integer'],
            'items.*.portion_id' => ['nullable', 'integer'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0', 'max:10000'],
        ], ['items.min' => 'A refeição precisa de pelo menos um ingrediente.']);

        $entry = new DiaryEntry(['date' => $data['date'], 'meal_id' => $data['meal_id']]);
        $entry->user_id = $user->id;

        if (! empty($data['recipe_id'])) {
            $recipe = Recipe::where('user_id', $user->id)->findOrFail($data['recipe_id']);
            $items = isset($data['items']) ? $this->adjustedItems($user, $data['items']) : null;
            $entry->fillFromRecipe($recipe, (float) $data['quantity'], $items);
        } else {
            $food = Food::visibleTo($user)->findOrFail($data['food_id']);
            $entry->fillFromFood($food, (float) $data['quantity'], $this->portion($food, $data['portion_id'] ?? null));
        }
        $entry->save();

        return response()->json(['entry' => $entry], 201);
    }

    /** Muda quantidade/porção/refeição. Recalcula pela origem se ela ainda existir. */
    public function update(Request $request, DiaryEntry $entry): JsonResponse
    {
        $user = $request->user();
        abort_unless($entry->user_id === $user->id, 404);

        $data = $request->validate([
            'meal_id' => ['sometimes', Rule::exists('meals', 'id')->where('user_id', $user->id)],
            'quantity' => ['required', 'numeric', 'gt:0', 'max:10000'],
            'portion_id' => ['nullable', 'integer'],
        ]);

        if (isset($data['meal_id'])) {
            $entry->meal_id = $data['meal_id'];
        }

        $quantity = (float) $data['quantity'];
        $food = $entry->food_id ? Food::find($entry->food_id) : null;

        if ($food) {
            $entry->fillFromFood($food, $quantity, $this->portion($food, $data['portion_id'] ?? null));
        } else {
            // Receita ou alimento excluído: escala o próprio registro (editar a receita não reescreve o passado)
            $this->scale($entry, $quantity);
        }
        $entry->save();

        return response()->json(['entry' => $entry]);
    }

    public function destroy(Request $request, DiaryEntry $entry): JsonResponse
    {
        abort_unless($entry->user_id === $request->user()->id, 404);
        $entry->delete();

        return response()->json(['ok' => true]);
    }

    /** Copia os itens de uma refeição de um dia para outra refeição/dia. */
    public function copy(Request $request): JsonResponse
    {
        $user = $request->user();
        $mealRule = Rule::exists('meals', 'id')->where('user_id', $user->id);
        $data = $request->validate([
            'from_date' => ['required', 'date_format:Y-m-d'],
            'from_meal_id' => ['required', $mealRule],
            'to_date' => ['required', 'date_format:Y-m-d'],
            'to_meal_id' => ['required', $mealRule],
        ]);

        $source = $user->entries()->whereDate('date', $data['from_date'])->where('meal_id', $data['from_meal_id'])->get();
        if ($source->isEmpty()) {
            throw ValidationException::withMessages(['from_date' => 'Não há itens nessa refeição para copiar.']);
        }

        foreach ($source as $e) {
            $copy = $e->replicate(['created_at', 'updated_at']);
            $copy->date = $data['to_date'];
            $copy->meal_id = $data['to_meal_id'];
            $copy->save();
        }

        return response()->json(['copied' => $source->count()], 201);
    }

    /** Escala proporcionalmente o snapshot existente para a nova quantidade. */
    private function scale(DiaryEntry $entry, float $quantity): void
    {
        $f = $entry->quantity > 0 ? $quantity / $entry->quantity : 1;
        foreach (['amount', 'kcal', 'carbs', 'protein', 'fat', 'sodium'] as $k) {
            $entry->{$k} = round($entry->{$k} * $f, 1);
        }
        $entry->quantity = $quantity;
    }

    /** Monta itens de receita em memória (não salvos) a partir do ajuste enviado. */
    private function adjustedItems(User $user, array $items): array
    {
        return array_map(function ($i) use ($user) {
            $food = Food::withTrashed()->visibleTo($user)->with('portions')->findOrFail($i['food_id']);
            $item = new RecipeItem(['food_id' => $food->id, 'quantity' => $i['quantity']]);
            $item->setRelation('food', $food);
            $item->setRelation('portion', ! empty($i['portion_id']) ? $food->portions->firstWhere('id', $i['portion_id']) : null);

            return $item;
        }, $items);
    }

    private function portion(Food $food, ?int $id): ?FoodPortion
    {
        return $id ? $food->portions()->findOrFail($id) : null;
    }
}
