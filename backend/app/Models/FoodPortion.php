<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FoodPortion extends Model
{
    public $timestamps = false;

    protected $fillable = ['label', 'qty'];

    protected $hidden = ['food_id'];

    protected function casts(): array
    {
        return ['qty' => 'float'];
    }
}
