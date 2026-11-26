<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Grava fotos enviadas pelo app no disco privado.
 * Regrava com GD: remove metadados (EXIF, inclusive localização GPS) e limita o tamanho.
 */
class ImageStore
{
    /**
     * @param  string  $folder  pasta no disco local (ex.: "checkins/12")
     * @param  int  $maxSide  maior lado em pixels
     * @param  bool  $square  recorta um quadrado central (foto de perfil)
     */
    public function store(UploadedFile $file, string $folder, int $maxSide = 1600, bool $square = false, string $field = 'photo'): string
    {
        $img = @imagecreatefromstring((string) file_get_contents($file->getRealPath()));
        if (! $img) {
            throw ValidationException::withMessages([$field => 'Não foi possível ler a imagem. Tente outra foto.']);
        }

        if ($square) {
            $side = min(imagesx($img), imagesy($img));
            $img = imagecrop($img, [
                'x' => intdiv(imagesx($img) - $side, 2),
                'y' => intdiv(imagesy($img) - $side, 2),
                'width' => $side,
                'height' => $side,
            ]) ?: $img;
        }

        $w = imagesx($img);
        $h = imagesy($img);
        $scale = min(1, $maxSide / max($w, $h));
        if ($scale < 1) {
            $img = imagescale($img, (int) round($w * $scale), (int) round($h * $scale), IMG_BICUBIC);
        }

        ob_start();
        imagejpeg($img, null, 82);
        $jpeg = ob_get_clean();

        $path = $folder.'/'.Str::uuid().'.jpg';
        Storage::disk('local')->put($path, $jpeg);

        return $path;
    }
}
