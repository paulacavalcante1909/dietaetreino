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
        $data = $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'time' => ['nullable', 'date_format:H:i'],
        ]);
        $user = $request->user();
        $meal = $user->meals()->create([
            'name' => $data['name'],
            'time' => $data['time'] ?? null,
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
            'time' => ['sometimes', 'nullable', 'date_format:H:i'],
        ], ['time.date_format' => 'Informe o horário como 07:30.']));

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
     * Sugestão para registrar uma refeição rápido: o que foi registrado nela da última vez
     * (`last`, para repetir inteira com 1 toque). Some quando a refeição já tem registro no dia.
     */
    public function suggestions(Request $request, Meal $meal): JsonResponse
    {
        abort_unless($meal->user_id === $request->user()->id, 404);
        $date = $request->validate(['date' => ['required', 'date_format:Y-m-d']])['date'];
        $entries = $request->user()->entries()->where('meal_id', $meal->id);

        $lastDate = (clone $entries)->whereDate('date', '<', $date)->whereDate('date', '>=', CarbonImmutable::parse($date)->subDays(30)->toDateString())
            ->max('date');
        // Refeição já registrada hoje (qualquer item): não sugere repetir
        $last = null;
        if ($lastDate && ! (clone $entries)->whereDate('date', $date)->exists()) {
            $items = (clone $entries)->whereDate('date', $lastDate)->orderBy('id')->get(['name', 'kcal']);
            $last = ['date' => substr((string) $lastDate, 0, 10), 'kcal' => round($items->sum('kcal')), 'items' => $items->pluck('name')->all()];
        }

        return response()->json(['last' => $last]);
    }
}
