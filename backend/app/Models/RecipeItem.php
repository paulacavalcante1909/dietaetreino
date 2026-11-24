<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RecipeItem extends Model
{
    public $timestamps = false;

    protected $fillable = ['food_id', 'portion_id', 'quantity', 'position'];

    protected $hidden = ['recipe_id'];

    protected function casts(): array
    {
        return ['quantity' => 'float'];
    }

    public function food(): BelongsTo
    {
        return $this->belongsTo(Food::class)->withTrashed();
    }

    public function portion(): BelongsTo
    {
        return $this->belongsTo(FoodPortion::class);
    }

    /** Quantidade total em g/ml. */
    public function amount(): float
    {
        return $this->portion ? $this->quantity * $this->portion->qty : $this->quantity;
    }
}
