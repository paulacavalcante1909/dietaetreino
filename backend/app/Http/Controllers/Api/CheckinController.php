<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Checkin;
use App\Models\Workout;
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
            ->whereBetween('date', [$start->toDateString(), $start->endOfMonth()->toDateString()])
            ->orderByDesc('date')->orderByDesc('id')
            ->get();

        return response()->json([
            'month' => $month,
            'checkins' => $checkins,
            'stats' => $this->stats($user->id, $start),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'workout_id' => ['required', 'integer'],
            'photo' => ['required', 'image', 'mimes:jpeg,png,webp,heic,heif', 'max:12288'],
            'note' => ['nullable', 'string', 'max:280'],
            'date' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today'],
        ], [
            'photo.required' => 'Tire ou escolha a foto do dia.',
            'photo.image' => 'O arquivo precisa ser uma imagem.',
            'photo.max' => 'A foto é muito grande (máximo 12 MB).',
        ]);

        $workout = Workout::where('user_id', $user->id)->findOrFail($data['workout_id']);
        $path = $this->storePhoto($data['photo'], $user->id);

        $checkin = new Checkin([
            'workout_id' => $workout->id,
            'workout_name' => $workout->name,
            'date' => $data['date'] ?? now()->toDateString(),
            'photo_path' => $path,
            'note' => $data['note'] ?? null,
        ]);
        $checkin->user_id = $user->id;
        $checkin->save();

        return response()->json(['checkin' => $checkin], 201);
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
            imagedestroy($img);
            $img = $resized;
        }

        ob_start();
        imagejpeg($img, null, 82);
        $jpeg = ob_get_clean();
        imagedestroy($img);

        $path = "checkins/{$userId}/".Str::uuid().'.jpg';
        Storage::disk('local')->put($path, $jpeg);

        return $path;
    }

    private function stats(int $userId, CarbonImmutable $monthStart): array
    {
        $dates = Checkin::where('user_id', $userId)
            ->selectRaw('DISTINCT date')->orderByDesc('date')->pluck('date')
            ->map(fn ($d) => substr((string) $d, 0, 10))->all();

        // Sequência: dias seguidos com check-in terminando hoje (ou ontem, se hoje ainda não treinou)
        $streak = 0;
        $set = array_flip($dates);
        $day = CarbonImmutable::today();
        if (! isset($set[$day->toDateString()])) {
            $day = $day->subDay();
        }
        while (isset($set[$day->toDateString()])) {
            $streak++;
            $day = $day->subDay();
        }

        $inMonth = count(array_filter($dates, fn ($d) => str_starts_with($d, $monthStart->format('Y-m'))));

        return [
            'streak' => $streak,
            'month_days' => $inMonth,
            'total_days' => count($dates),
            'today' => isset($set[CarbonImmutable::today()->toDateString()]),
        ];
    }
}
