<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Meal;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MealController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->user()->ensureMeals();

        return response()->json(['meals' => $request->user()->meals()->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:60']]);
        $user = $request->user();
        $meal = $user->meals()->create([
            'name' => $data['name'],
            'position' => (int) $user->meals()->max('position') + 1,
        ]);

        return response()->json(['meal' => $meal], 201);
    }

    public function update(Request $request, Meal $meal): JsonResponse
    {
        abort_unless($meal->user_id === $request->user()->id, 404);
        $meal->update($request->validate([
            'name' => ['sometimes', 'string', 'max:60'],
            'active' => ['sometimes', 'boolean'],
        ]));

        return response()->json(['meal' => $meal]);
    }

    /** Recebe a lista de ids na nova ordem. */
    public function reorder(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer', Rule::exists('meals', 'id')->where('user_id', $user->id)],
        ]);
        foreach ($data['ids'] as $i => $id) {
            $user->meals()->whereKey($id)->update(['position' => $i]);
        }

        return response()->json(['meals' => $user->meals()->get()]);
    }

    /** Refeição com histórico é apenas ocultada, para não apagar registros. */
    public function destroy(Request $request, Meal $meal): JsonResponse
    {
        abort_unless($meal->user_id === $request->user()->id, 404);
        if ($meal->entries()->exists()) {
            $meal->update(['active' => false]);

            return response()->json(['hidden' => true]);
        }
        $meal->delete();

        return response()->json(['deleted' => true]);
    }

    /**
     * Sugestões para registrar uma refeição rápido:
     * - `last`: o que foi registrado nela da última vez (para repetir inteira);
     * - `frequent`: o que mais aparece nela nos últimos 60 dias, com a porção da última vez
     *   (sem o que já foi registrado na refeição neste dia).
     */
    public function suggestions(Request $request, Meal $meal): JsonResponse
    {
        abort_unless($meal->user_id === $request->user()->id, 404);
        $date = $request->validate(['date' => ['required', 'date_format:Y-m-d']])['date'];
        $entries = $request->user()->entries()->where('meal_id', $meal->id);

        $lastDate = (clone $entries)->whereDate('date', '<', $date)->whereDate('date', '>=', CarbonImmutable::parse($date)->subDays(30)->toDateString())
            ->max('date');
        $today = (clone $entries)->whereDate('date', $date)->get(['food_id', 'recipe_id']);
        $last = null;
        if ($lastDate) {
            $items = (clone $entries)->whereDate('date', $lastDate)->orderBy('id')->get(['name', 'kcal', 'food_id', 'recipe_id']);
            // Já repetida hoje (tudo dela já está registrado): não sugere de novo
            $alreadyToday = $items->every(fn ($i) => $today->contains(fn ($t) => $t->food_id === $i->food_id && $t->recipe_id === $i->recipe_id));
            if (! $alreadyToday) {
                $last = ['date' => substr((string) $lastDate, 0, 10), 'kcal' => round($items->sum('kcal')), 'items' => $items->pluck('name')->all()];
            }
        }

        $recent = (clone $entries)
            ->whereDate('date', '>=', CarbonImmutable::parse($date)->subDays(60)->toDateString())
            ->where(fn ($q) => $q->whereNotNull('food_id')->orWhereNotNull('recipe_id'))
            ->orderByDesc('id')
            ->get(['food_id', 'recipe_id', 'name', 'quantity', 'portion_id', 'unit_label', 'kcal']);

        $frequent = $recent
            ->groupBy(fn ($e) => $e->recipe_id ? 'r'.$e->recipe_id : 'f'.$e->food_id)
            ->reject(fn ($group) => $today->contains(fn ($t) => $group[0]->recipe_id ? $t->recipe_id === $group[0]->recipe_id : $t->food_id === $group[0]->food_id))
            ->sortByDesc(fn ($group) => $group->count())
            ->take(8)
            ->map(fn ($group) => [
                ...$group[0]->only('food_id', 'recipe_id', 'name', 'quantity', 'portion_id', 'unit_label'),
                'kcal' => round($group[0]->kcal),
                'times' => $group->count(),
            ])
            ->values();

        return response()->json(['last' => $last, 'frequent' => $frequent]);
    }
}
