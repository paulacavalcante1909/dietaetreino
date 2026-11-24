<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GoalController extends Controller
{
    /** Meta vigente em uma data (?date=YYYY-MM-DD, padrão hoje). */
    public function show(Request $request): JsonResponse
    {
        $date = $request->validate(['date' => ['nullable', 'date_format:Y-m-d']])['date']
            ?? now()->toDateString();

        return response()->json(['goal' => $request->user()->goalFor($date)]);
    }

    /** Define a meta a partir de hoje. Dias passados mantêm a meta da época. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kcal' => ['required', 'integer', 'min:500', 'max:10000'],
            'carbs_g' => ['required', 'numeric', 'min:0', 'max:2000'],
            'protein_g' => ['required', 'numeric', 'min:0', 'max:1000'],
            'fat_g' => ['required', 'numeric', 'min:0', 'max:1000'],
            'sodium_mg' => ['required', 'integer', 'min:0', 'max:20000'],
            'water_ml' => ['required', 'integer', 'min:0', 'max:10000'],
        ]);

        $goal = $request->user()->goals()->updateOrCreate(
            ['valid_from' => now()->toDateString()],
            $data,
        );

        return response()->json(['goal' => $goal->fresh()]);
    }
}
