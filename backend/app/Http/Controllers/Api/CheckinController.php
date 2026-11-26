<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Checkin;
use App\Models\User;
use App\Models\Workout;
use App\Models\WorkoutSession;
use App\Services\ImageStore;
use App\Services\TrainingLog;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CheckinController extends Controller
{
    /** Check-ins de um mês (?month=YYYY-MM) + estatísticas. */
    public function index(Request $request): JsonResponse
    {
        $month = $request->validate(['month' => ['nullable', 'date_format:Y-m']])['month'] ?? now()->format('Y-m');
        $start = CarbonImmutable::createFromFormat('Y-m-d', $month.'-01')->startOfDay();
        $user = $request->user();

        $checkins = Checkin::where('user_id', $user->id)
            ->with('session')
            ->whereBetween('date', [$start->toDateString(), $start->endOfMonth()->toDateString()])
            ->orderByDesc('date')->orderByDesc('id')
            ->get();

        // Treinos feitos no app sem check-in também aparecem no histórico
        $sessions = app(TrainingLog::class)->sessionsWithoutCheckin($user->id)
            ->whereBetween('date', [$start->toDateString(), $start->endOfMonth()->toDateString()])
            ->orderByDesc('date')->orderByDesc('id')
            ->get();

        return response()->json([
            'month' => $month,
            'checkins' => $checkins,
            'sessions' => $sessions,
            'stats' => $this->stats($user->id, $start),
        ]);
    }

    public function store(Request $request, ImageStore $images): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            // Treino da ficha (workout_id) OU exercício avulso (apenas session_id, sem ficha)
            'workout_id' => ['required_without:session_id', 'nullable', 'integer'],
            'session_id' => ['nullable', 'integer'],
            'photo' => ['nullable', 'image', 'mimes:jpeg,png,webp,heic,heif', 'max:12288'],
            'note' => ['nullable', 'string', 'max:280'],
            'remove_photo' => ['sometimes', 'boolean'],
            'date' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today'],
        ], [
            'workout_id.required_without' => 'Escolha um treino da ficha ou um exercício.',
            'photo.required' => 'Tire ou escolha a foto do dia.',
            'photo.image' => 'O arquivo precisa ser uma imagem.',
            'photo.max' => 'A foto é muito grande (máximo 12 MB).',
        ]);

        $workout = ! empty($data['workout_id']) ? Workout::where('user_id', $user->id)->findOrFail($data['workout_id']) : null;
        $session = ! empty($data['session_id']) ? WorkoutSession::where('user_id', $user->id)->find($data['session_id']) : null;
        if (! $workout && ! $session) {
            throw ValidationException::withMessages(['session_id' => 'Escolha um treino da ficha ou um exercício.']);
        }
        $path = isset($data['photo']) ? $images->store($data['photo'], "checkins/{$user->id}") : null;

        // Um treino tem uma foto só: enviar de novo troca a foto e/ou a anotação
        $existing = $session ? Checkin::where('user_id', $user->id)->where('session_id', $session->id)->first() : null;
        if ($existing) {
            $removePhoto = (bool) ($data['remove_photo'] ?? false);
            if (($path || $removePhoto) && $existing->photo_path) {
                Storage::disk('local')->delete($existing->photo_path);
            }
            $existing->update([
                'photo_path' => $path ?? ($removePhoto ? null : $existing->photo_path),
                'note' => array_key_exists('note', $data) ? $data['note'] : $existing->note,
            ]);

            return response()->json(['checkin' => $existing->load('session')]);
        }

        $checkin = new Checkin([
            'workout_id' => $workout?->id ?? $session?->workout_id,
            'session_id' => $session?->id,
            // Avulso: o nome vem do registro (ex.: "Corrida na esteira")
            'workout_name' => $workout?->name ?? $session->workout_name,
            // Foto de um treino registrado: vale para o dia do treino
            'date' => $session?->date?->toDateString() ?? $data['date'] ?? now()->toDateString(),
            'photo_path' => $path,
            'note' => $data['note'] ?? null,
        ]);
        $checkin->user_id = $user->id;
        $checkin->save();

        return response()->json(['checkin' => $checkin->load('session')], 201);
    }

    public function destroy(Request $request, Checkin $checkin): JsonResponse
    {
        abort_unless($checkin->user_id === $request->user()->id, 404);
        $checkin->delete(); // apaga o arquivo também (evento no model)

        return response()->json(['ok' => true]);
    }

    /** Entrega a foto via link assinado (middleware `signed`). */
    public function photo(Checkin $checkin): StreamedResponse
    {
        return Storage::disk('local')->response($checkin->photo_path, null, [
            'Cache-Control' => 'private, max-age=21600',
        ]);
    }

    /**
     * Estatísticas de treino: sequência, mês, total e semana atual.
     * Contam check-ins e também treinos feitos no app sem check-in.
     *
     * @return array{streak: int, month_count: int, total_count: int, today: bool, week_days: int, weekly_goal: int}
     */
    private function stats(int $userId, CarbonImmutable $monthStart): array
    {
        $log = app(TrainingLog::class);
        $set = $log->dates($userId)->flip();

        // Sequência: dias seguidos com treino terminando hoje (ou ontem, se hoje ainda não treinou)
        $streak = 0;
        $day = CarbonImmutable::today();
        if (! isset($set[$day->toDateString()])) {
            $day = $day->subDay();
        }
        while (isset($set[$day->toDateString()])) {
            $streak++;
            $day = $day->subDay();
        }

        $weekStart = CarbonImmutable::today()->startOfWeek();

        return [
            'streak' => $streak,
            'month_count' => $log->count($userId, $monthStart->toDateString(), $monthStart->endOfMonth()->toDateString()),
            'total_count' => $log->count($userId),
            'today' => isset($set[CarbonImmutable::today()->toDateString()]),
            'week_days' => $log->dates($userId, $weekStart->toDateString(), $weekStart->endOfWeek()->toDateString())->count(),
            'weekly_goal' => (int) (User::whereKey($userId)->value('weekly_workout_goal') ?? 3),
        ];
    }
}
