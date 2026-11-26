<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\URL;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'password', 'terms_accepted_at', 'add_burned_to_goal', 'weekly_workout_goal', 'sex', 'birth_date', 'height_cm', 'avatar_path'])]
#[Hidden(['password', 'remember_token', 'email_verified_at', 'updated_at', 'avatar_path'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /** @var list<string> */
    protected $appends = ['avatar_url'];

    /** Link temporário assinado da foto de perfil (privada). */
    public function getAvatarUrlAttribute(): ?string
    {
        if (! $this->avatar_path) {
            return null;
        }

        // A versão no link troca a cada foto nova (o navegador não mostra a antiga do cache)
        return URL::temporarySignedRoute('users.avatar', now()->addHours(6), ['user' => $this->id, 'v' => substr(md5($this->avatar_path), 0, 8)], absolute: false);
    }

    public function exerciseFavorites(): BelongsToMany
    {
        return $this->belongsToMany(Exercise::class, 'exercise_favorites')->withPivot('created_at');
    }

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'terms_accepted_at' => 'datetime',
            'add_burned_to_goal' => 'boolean',
            'weekly_workout_goal' => 'integer',
            'birth_date' => 'date:Y-m-d',
            'height_cm' => 'integer',
            'password' => 'hashed',
        ];
    }

    protected static function booted(): void
    {
        static::created(fn (User $user) => $user->ensureMeals());
    }

    public function goals(): HasMany
    {
        return $this->hasMany(Goal::class);
    }

    public function meals(): HasMany
    {
        return $this->hasMany(Meal::class)->orderBy('position')->orderBy('id');
    }

    public function entries(): HasMany
    {
        return $this->hasMany(DiaryEntry::class);
    }

    public function waterLogs(): HasMany
    {
        return $this->hasMany(WaterLog::class);
    }

    public function foods(): HasMany
    {
        return $this->hasMany(Food::class);
    }

    public function favorites(): BelongsToMany
    {
        return $this->belongsToMany(Food::class, 'favorites')->withPivot('created_at');
    }

    /**
     * Meta vigente em uma data (a mais recente com valid_from <= data).
     * Para dias anteriores à primeira meta, usa a primeira meta definida.
     */
    public function goalFor(string $date): ?Goal
    {
        return $this->goals()
            ->whereDate('valid_from', '<=', $date)
            ->orderByDesc('valid_from')
            ->first()
            ?? $this->goals()->orderBy('valid_from')->first();
    }

    /** Cria as refeições padrão se a usuária ainda não tiver nenhuma. */
    public function ensureMeals(): void
    {
        if ($this->meals()->exists()) {
            return;
        }
        foreach (Meal::DEFAULTS as $i => $name) {
            $this->meals()->create(['name' => $name, 'position' => $i, 'time' => Meal::TIMES[$name] ?? null]);
        }
    }
}
