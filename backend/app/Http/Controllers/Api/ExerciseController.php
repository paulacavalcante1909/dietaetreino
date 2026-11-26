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
            'group' => ['nullable', Rule::in([...array_keys(Exercise::GROUPS), 'favoritos'])],
            'q' => ['nullable', 'string', 'max:60'],
        ]);

        $user = $request->user();
        $favorites = $user->exerciseFavorites()->pluck('exercises.id')->flip();
        $query = Exercise::visibleTo($user);
        if (($data['group'] ?? null) === 'favoritos') {
            $query->whereIn('id', $favorites->keys());
        } elseif (! empty($data['group'])) {
            $query->where('muscle_group', $data['group']);
        }
        foreach (array_filter(explode(' ', Food::normalize($data['q'] ?? ''))) as $w) {
            $query->where('search_name', 'like', '%'.$w.'%');
        }

        // Favoritos primeiro, depois os personalizados e a biblioteca
        $exercises = $query->orderByRaw('user_id IS NULL')->orderBy('name')->get()
            ->each(fn (Exercise $e) => $e->setAttribute('favorite', isset($favorites[$e->id])))
            ->sortBy(fn (Exercise $e) => $e->favorite ? 0 : 1)
            ->values();

        return response()->json([
            'groups' => Exercise::GROUPS,
            'exercises' => $exercises,
        ]);
    }

    public function favorite(Request $request, Exercise $exercise): JsonResponse
    {
        abort_unless($exercise->user_id === null || $exercise->user_id === $request->user()->id, 404);
        $request->user()->exerciseFavorites()->syncWithoutDetaching([$exercise->id => ['created_at' => now()]]);

        return response()->json(['ok' => true]);
    }

    public function unfavorite(Request $request, Exercise $exercise): JsonResponse
    {
        $request->user()->exerciseFavorites()->detach($exercise->id);

        return response()->json(['ok' => true]);
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
