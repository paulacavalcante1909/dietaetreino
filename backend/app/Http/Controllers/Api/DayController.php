<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WorkoutSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class DayController extends Controller
{
    /** Tudo que o painel do dia precisa em uma chamada. */
    public function show(Request $request, string $date): JsonResponse
    {
        Validator::make(['date' => $date], ['date' => ['date_format:Y-m-d']])->validate();

        $user = $request->user();
        $user->ensureMeals();

        $entries = $user->entries()->whereDate('date', $date)->orderBy('id')->get()->groupBy('meal_id');

        // Refeições ativas + inativas que tenham itens neste dia
        $meals = $user->meals()->get()
            ->filter(fn ($m) => $m->active || $entries->has($m->id))
            ->values()
            ->map(function ($m) use ($entries) {
                $items = $entries->get($m->id, collect())->values();

                return [
                    'id' => $m->id,
                    'name' => $m->name,
                    'kcal' => round($items->sum('kcal'), 1),
                    'entries' => $items,
                ];
            });

        $all = $entries->flatten();
        $water = $user->waterLogs()->whereDate('date', $date)->orderBy('id')->get();

        // Gasto estimado nos treinos do dia; só entra na meta se a usuária escolheu em Ajustes
        $burned = (int) WorkoutSession::where('user_id', $user->id)->whereDate('date', $date)->sum('kcal_burned');
        $goal = $user->goalFor($date);

        return response()->json([
            'date' => $date,
            'goal' => $goal,
            'burned' => $burned,
            'add_burned_to_goal' => (bool) $user->add_burned_to_goal,
            'kcal_target' => $goal ? $goal->kcal + ($user->add_burned_to_goal ? $burned : 0) : null,
            'totals' => [
                'kcal' => round($all->sum('kcal'), 1),
                'carbs' => round($all->sum('carbs'), 1),
                'protein' => round($all->sum('protein'), 1),
                'fat' => round($all->sum('fat'), 1),
                'sodium' => round($all->sum('sodium'), 1),
                'water' => (int) $water->sum('ml'),
            ],
            'meals' => $meals,
            'water' => $water,
        ]);
    }
}
