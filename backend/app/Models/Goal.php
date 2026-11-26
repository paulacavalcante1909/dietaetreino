<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Goal extends Model
{
    protected $fillable = [
        'valid_from', 'kcal', 'kcal_mode', 'carbs_g', 'protein_g', 'fat_g', 'sodium_mg', 'fiber_g', 'water_ml',
    ];

    protected $hidden = ['user_id', 'created_at', 'updated_at'];

    protected function casts(): array
    {
        return [
            'valid_from' => 'date:Y-m-d',
            'kcal' => 'integer',
            'carbs_g' => 'float',
            'protein_g' => 'float',
            'fat_g' => 'float',
            'sodium_mg' => 'integer',
            'fiber_g' => 'integer',
            'water_ml' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
