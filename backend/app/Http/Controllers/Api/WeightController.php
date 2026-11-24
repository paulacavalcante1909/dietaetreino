<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Weight;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class WeightController extends Controller
{
    /** Registros de um período (?range=30|90|365|all) + resumo. */
    public function index(Request $request): JsonResponse
    {
        $range = $request->validate(['range' => ['nullable', Rule::in(['30', '90', '365', 'all'])]])['range'] ?? '90';
        $base = Weight::where('user_id', $request->user()->id);

        $weights = (clone $base)
            ->when($range !== 'all', fn ($q) => $q->whereDate('date', '>=', now()->subDays((int) $range)->toDateString()))
            ->orderBy('date')
            ->get();

        $first = (clone $base)->orderBy('date')->first();
        $last = (clone $base)->orderByDesc('date')->first();

        return response()->json([
            'range' => $range,
            'weights' => $weights,
            'summary' => [
                'current' => $last?->kg,
                'current_date' => $last?->date?->toDateString(),
                'start' => $first?->kg,
                'start_date' => $first?->date?->toDateString(),
                'change_total' => $first && $last ? round($last->kg - $first->kg, 1) : null,
                'change_range' => $weights->count() > 1 ? round($weights->last()->kg - $weights->first()->kg, 1) : null,
            ],
        ]);
    }

    /** Novo registro; se já houver um no mesmo dia, substitui. */
    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $weight = Weight::updateOrCreate(
            ['user_id' => $request->user()->id, 'date' => $data['date']],
            ['kg' => $data['kg']],
        );

        return response()->json(['weight' => $weight], 201);
    }

    public function update(Request $request, Weight $weight): JsonResponse
    {
        abort_unless($weight->user_id === $request->user()->id, 404);
        $data = $this->validated($request);

        // Mudou para um dia que já tem registro: o outro dá lugar a este
        Weight::where('user_id', $weight->user_id)->whereDate('date', $data['date'])->whereKeyNot($weight->id)->delete();
        $weight->update($data);

        return response()->json(['weight' => $weight]);
    }

    public function destroy(Request $request, Weight $weight): JsonResponse
    {
        abort_unless($weight->user_id === $request->user()->id, 404);
        $weight->delete();

        return response()->json(['ok' => true]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'date' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'kg' => ['required', 'numeric', 'min:20', 'max:400'],
        ], [
            'date.before_or_equal' => 'A data não pode ser no futuro.',
            'kg.min' => 'Confira o peso informado.',
            'kg.max' => 'Confira o peso informado.',
        ]);
    }
}
