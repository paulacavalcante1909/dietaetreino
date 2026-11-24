<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Workout extends Model
{
    protected $fillable = ['name', 'position'];

    protected $hidden = ['user_id', 'created_at'];

    public function items(): HasMany
    {
        return $this->hasMany(WorkoutItem::class)->orderBy('position')->orderBy('id');
    }
}
