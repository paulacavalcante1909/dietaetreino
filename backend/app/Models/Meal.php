<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Meal extends Model
{
    public const DEFAULTS = ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia'];

    /** Horário padrão de cada refeição (a usuária pode mudar em Refeições do dia) */
    public const TIMES = [
        'Café da manhã' => '07:00', 'Lanche da manhã' => '10:00', 'Almoço' => '12:00',
        'Lanche da tarde' => '15:30', 'Jantar' => '19:00', 'Ceia' => '21:30',
    ];

    protected $fillable = ['name', 'position', 'active', 'time'];

    protected $hidden = ['user_id', 'created_at', 'updated_at'];

    protected function casts(): array
    {
        return ['active' => 'boolean', 'position' => 'integer'];
    }

    public function entries(): HasMany
    {
        return $this->hasMany(DiaryEntry::class);
    }
}
