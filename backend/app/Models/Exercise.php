<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class Exercise extends Model
{
    public const GROUPS = [
        'peito' => 'Peito', 'costas' => 'Costas', 'ombros' => 'Ombros', 'biceps' => 'Bíceps',
        'triceps' => 'Tríceps', 'quadriceps' => 'Quadríceps', 'posterior' => 'Posterior de coxa',
        'gluteos' => 'Glúteos', 'adutores' => 'Adutores', 'panturrilha' => 'Panturrilha',
        'abdomen' => 'Abdômen', 'lombar' => 'Lombar', 'trapezio' => 'Trapézio',
        'antebraco' => 'Antebraço', 'cardio' => 'Cardio',
    ];

    protected $fillable = ['source_id', 'name', 'muscle_group', 'image'];

    protected $hidden = ['search_name', 'source_id', 'created_at', 'updated_at'];

    protected static function booted(): void
    {
        static::saving(fn (Exercise $e) => $e->search_name = Food::normalize($e->name));
    }

    public function scopeVisibleTo(Builder $q, User $user): Builder
    {
        return $q->where(fn ($w) => $w->whereNull('user_id')->orWhere('user_id', $user->id));
    }
}
