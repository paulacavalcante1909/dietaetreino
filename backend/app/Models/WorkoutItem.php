<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkoutItem extends Model
{
    public $timestamps = false;

    protected $fillable = ['exercise_id', 'position', 'sets', 'reps', 'notes'];

    protected $hidden = ['workout_id'];

    protected function casts(): array
    {
        return ['sets' => 'integer'];
    }

    public function exercise(): BelongsTo
    {
        return $this->belongsTo(Exercise::class);
    }
}
