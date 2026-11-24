<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Exercise;
use App\Models\Food;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ExerciseController extends Controller
{
    /** Biblioteca (padrão + personalizados), filtrável por grupo e nome. */
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'group' => ['nullable', Rule::in(array_keys(Exercise::GROUPS))],
            'q' => ['nullable', 'string', 'max:60'],
        ]);

        $query = Exercise::visibleTo($request->user());
        if (! empty($data['group'])) {
            $query->where('muscle_group', $data['group']);
        }
        foreach (array_filter(explode(' ', Food::normalize($data['q'] ?? ''))) as $w) {
            $query->where('search_name', 'like', '%'.$w.'%');
        }

        return response()->json([
            'groups' => Exercise::GROUPS,
            'exercises' => $query->orderByRaw('user_id IS NULL')->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'muscle_group' => ['required', Rule::in(array_keys(Exercise::GROUPS))],
        ]);
        $exercise = new Exercise($data);
        $exercise->user_id = $request->user()->id;
        $exercise->save();

        return response()->json(['exercise' => $exercise], 201);
    }

    public function destroy(Request $request, Exercise $exercise): JsonResponse
    {
        abort_unless($exercise->user_id === $request->user()->id, 403, 'Só é possível excluir exercícios que você criou.');
        $exercise->delete(); // remove também dos treinos (cascade)

        return response()->json(['ok' => true]);
    }
}
