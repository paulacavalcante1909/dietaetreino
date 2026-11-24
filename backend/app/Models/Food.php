<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Food extends Model
{
    use SoftDeletes;

    protected $table = 'foods';

    protected $fillable = [
        'user_id', 'source', 'external_id', 'ean', 'name', 'brand', 'category',
        'base_qty', 'base_unit', 'kcal', 'carbs', 'protein', 'fat', 'sodium', 'fiber',
    ];

    protected $hidden = ['search_name', 'external_id', 'created_at', 'updated_at', 'deleted_at'];

    protected function casts(): array
    {
        return [
            'base_qty' => 'float', 'kcal' => 'float', 'carbs' => 'float', 'protein' => 'float',
            'fat' => 'float', 'sodium' => 'float', 'fiber' => 'float',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (Food $food) {
            $food->search_name = self::normalize(trim($food->name.' '.$food->brand));
        });
    }

    public static function normalize(string $s): string
    {
        return Str::of($s)->ascii()->lower()->replaceMatches('/[^a-z0-9 ]+/', ' ')->squish()->toString();
    }

    public function portions(): HasMany
    {
        return $this->hasMany(FoodPortion::class);
    }

    /** Alimentos que a usuária pode ver: globais + os dela. */
    public function scopeVisibleTo(Builder $q, User $user): Builder
    {
        return $q->where(fn ($w) => $w->whereNull('user_id')->orWhere('user_id', $user->id));
    }

    public function isOwnedBy(User $user): bool
    {
        return $this->user_id === $user->id;
    }

    /** Calcula os nutrientes para uma quantidade em base_unit. */
    public function nutrientsFor(float $amount): array
    {
        $f = $this->base_qty > 0 ? $amount / $this->base_qty : 0;

        return [
            'kcal' => round($this->kcal * $f, 1),
            'carbs' => round($this->carbs * $f, 1),
            'protein' => round($this->protein * $f, 1),
            'fat' => round($this->fat * $f, 1),
            'sodium' => round($this->sodium * $f, 1),
        ];
    }
}
