<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WaterLog extends Model
{
    protected $fillable = ['date', 'ml'];

    protected $hidden = ['user_id', 'updated_at'];

    protected function casts(): array
    {
        return ['date' => 'date:Y-m-d', 'ml' => 'integer'];
    }
}
