<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Exercise;
use App\Models\Workout;
use App\Models\WorkoutSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class WorkoutController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        $workouts = Workout::where('user_id', $userId)
            ->with('items.exercise')
            ->orderBy('position')->orderBy('id')
            ->get();

        // Última vez que cada treino foi executado (para "Feito hoje ✓" na ficha)
        $last = WorkoutSession::where('user_id', $userId)
            ->whereIn('workout_id', $workouts->pluck('id'))
            ->selectRaw('workout_id, MAX(date) as last_done_on')
            ->groupBy('workout_id')
            ->pluck('last_done_on', 'workout_id');
        $workouts->each(fn ($w) => $w->setAttribute('last_done_on', $last[$w->id] ?? null));

        return response()->json(['workouts' => $workouts]);
    }

    public function show(Request $request, Workout $workout): JsonResponse
    {
        $this->own($request, $workout);

        return response()->json(['workout' => $workout->load('items.exercise')]);
    }

    /** Cria com nome sugerido "Treino A/B/C…" quando não informado. */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate(['name' => ['nullable', 'string', 'max:80']]);
        $count = Workout::where('user_id', $user->id)->count();

        $workout = new Workout([
            'name' => $data['name'] ?? 'Treino '.($count < 26 ? chr(65 + $count) : $count + 1),
            'position' => $count,
        ]);
        $workout->user_id = $user->id;
        $workout->save();

        return response()->json(['workout' => $workout->load('items.exercise')], 201);
    }

    /** Substitui nome e lista de exercícios (ordem = ordem do array). */
    public function update(Request $request, Workout $workout): JsonResponse
    {
        $this->own($request, $workout);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'items' => ['present', 'array', 'max:40'],
            'items.*.exercise_id' => ['required', 'integer'],
            'items.*.sets' => ['required', 'integer', 'min:1', 'max:10'],
            'items.*.reps' => ['required', 'string', 'max:20'],
            'items.*.notes' => ['nullable', 'string', 'max:200'],
        ]);

        $allowed = Exercise::visibleTo($request->user())
            ->whereIn('id', array_column($data['items'], 'exercise_id'))->pluck('id')->all();

        DB::transaction(function () use ($workout, $data, $allowed) {
            $workout->update(['name' => $data['name']]);
            $workout->items()->delete();
            foreach (array_values($data['items']) as $i => $item) {
                if (! in_array($item['exercise_id'], $allowed)) {
                    continue;
                }
                $workout->items()->create([
                    'exercise_id' => $item['exercise_id'],
                    'position' => $i,
                    'sets' => $item['sets'],
                    'reps' => trim($item['reps']),
                    'notes' => $item['notes'] ?? null,
                ]);
            }
        });

        return response()->json(['workout' => $workout->fresh()->load('items.exercise')]);
    }

    public function destroy(Request $request, Workout $workout): JsonResponse
    {
        $this->own($request, $workout);
        $workout->delete(); // check-ins mantêm o nome do treino (snapshot)

        return response()->json(['ok' => true]);
    }

    public function duplicate(Request $request, Workout $workout): JsonResponse
    {
        $this->own($request, $workout);
        $copy = DB::transaction(function () use ($request, $workout) {
            $copy = $workout->replicate(['created_at', 'updated_at']);
            $copy->name = mb_substr($workout->name.' (cópia)', 0, 80);
            $copy->position = Workout::where('user_id', $request->user()->id)->count();
            $copy->save();
            foreach ($workout->items as $item) {
                $copy->items()->create($item->only('exercise_id', 'position', 'sets', 'reps', 'notes'));
            }

            return $copy;
        });

        return response()->json(['workout' => $copy->load('items.exercise')], 201);
    }

    public function reorder(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer', Rule::exists('workouts', 'id')->where('user_id', $user->id)],
        ]);
        foreach ($data['ids'] as $i => $id) {
            Workout::whereKey($id)->where('user_id', $user->id)->update(['position' => $i]);
        }

        return response()->json(['ok' => true]);
    }

    private function own(Request $request, Workout $workout): void
    {
        abort_unless($workout->user_id === $request->user()->id, 404);
    }
}
