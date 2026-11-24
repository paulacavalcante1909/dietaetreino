<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

class Checkin extends Model
{
    protected $fillable = ['workout_id', 'workout_name', 'date', 'photo_path', 'note'];

    protected $hidden = ['user_id', 'photo_path', 'updated_at'];

    protected $appends = ['photo_url'];

    protected function casts(): array
    {
        return ['date' => 'date:Y-m-d'];
    }

    protected static function booted(): void
    {
        static::deleted(fn (Checkin $c) => Storage::disk('local')->delete($c->photo_path));
    }

    /** Link temporário assinado: a foto é privada e não fica acessível por URL fixa. */
    public function getPhotoUrlAttribute(): string
    {
        return URL::temporarySignedRoute('checkins.photo', now()->addHours(6), ['checkin' => $this->id], absolute: false);
    }
}
