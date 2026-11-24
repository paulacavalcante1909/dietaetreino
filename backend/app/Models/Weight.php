<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Weight extends Model
{
    protected $fillable = ['user_id', 'date', 'kg']; // user_id só é definido pelo servidor

    protected $hidden = ['user_id', 'created_at', 'updated_at'];

    protected function casts(): array
    {
        return ['date' => 'date:Y-m-d', 'kg' => 'float'];
    }
}
