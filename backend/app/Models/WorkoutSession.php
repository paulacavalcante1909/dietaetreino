<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WorkoutSession extends Model
{
    protected $fillable = ['workout_id', 'workout_name', 'date', 'started_at', 'finished_at', 'duration_seconds', 'exercises'];

    protected $hidden = ['user_id', 'updated_at'];

    protected function casts(): array
    {
        return [
            'date' => 'date:Y-m-d',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
            'duration_seconds' => 'integer',
            'kcal_burned' => 'integer',
            'weight_kg' => 'float',
            'weight_estimated' => 'boolean',
            'exercises' => 'array',
        ];
    }
}
