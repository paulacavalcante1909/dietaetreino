<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Checkin;
use App\Models\User;
use App\Models\Workout;
use App\Models\WorkoutSession;
use App\Services\TrainingLog;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
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

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            // Treino da ficha (workout_id) OU exercício avulso (apenas session_id, sem ficha)
            'workout_id' => ['required_without:session_id', 'nullable', 'integer'],
            'session_id' => ['nullable', 'integer'],
            'photo' => ['nullable', 'image', 'mimes:jpeg,png,webp,heic,heif', 'max:12288'],
            'note' => ['nullable', 'string', 'max:280'],
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
        $path = isset($data['photo']) ? $this->storePhoto($data['photo'], $user->id) : null;

        $checkin = new Checkin([
            'workout_id' => $workout?->id,
            'session_id' => $session?->id,
            // Avulso: o nome vem do registro (ex.: "Corrida na esteira")
            'workout_name' => $workout?->name ?? $session->workout_name,
            'date' => $data['date'] ?? now()->toDateString(),
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
     * Regrava a imagem com GD: remove metadados (EXIF, inclusive localização GPS)
     * e limita o tamanho a 1600 px.
     */
    private function storePhoto(UploadedFile $file, int $userId): string
    {
        $img = @imagecreatefromstring((string) file_get_contents($file->getRealPath()));
        if (! $img) {
            throw ValidationException::withMessages(['photo' => 'Não foi possível ler a imagem. Tente outra foto.']);
        }

        $w = imagesx($img);
        $h = imagesy($img);
        $scale = min(1, 1600 / max($w, $h));
        if ($scale < 1) {
            $resized = imagescale($img, (int) round($w * $scale), (int) round($h * $scale), IMG_BICUBIC);
            $img = $resized;
        }

        ob_start();
        imagejpeg($img, null, 82);
        $jpeg = ob_get_clean();

        $path = "checkins/{$userId}/".Str::uuid().'.jpg';
        Storage::disk('local')->put($path, $jpeg);

        return $path;
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
