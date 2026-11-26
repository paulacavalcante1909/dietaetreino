<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DiaryEntry extends Model
{
    protected $fillable = [
        'date', 'meal_id', 'food_id', 'recipe_id', 'portion_id', 'name', 'brand', 'quantity', 'unit_label',
        'amount', 'base_unit', 'kcal', 'carbs', 'protein', 'fat', 'sodium', 'fiber',
    ];

    protected $hidden = ['user_id', 'created_at', 'updated_at'];

    protected function casts(): array
    {
        return [
            'date' => 'date:Y-m-d',
            'quantity' => 'float', 'amount' => 'float', 'kcal' => 'float', 'carbs' => 'float',
            'protein' => 'float', 'fat' => 'float', 'sodium' => 'float', 'fiber' => 'float',
        ];
    }

    public function food(): BelongsTo
    {
        return $this->belongsTo(Food::class)->withTrashed();
    }

    /**
     * Snapshot a partir de uma receita: quantity = nº de porções.
     * $items = ingredientes ajustados só para este registro (a receita original não muda).
     */
    public function fillFromRecipe(Recipe $recipe, float $servings, ?iterable $items = null): static
    {
        $per = $recipe->perServing($items);
        $grams = rtrim(rtrim(number_format($per['amount'], 1, ',', ''), '0'), ',');

        $this->fill([
            'food_id' => null,
            'recipe_id' => $recipe->id,
            'portion_id' => null,
            'name' => mb_substr($recipe->name.($items !== null ? ' (ajustada)' : ''), 0, 190),
            'brand' => 'Receita',
            'quantity' => $servings,
            'unit_label' => "1 porção ({$grams} g)",
            'amount' => round($per['amount'] * $servings, 1),
            'base_unit' => 'g',
            'kcal' => round($per['kcal'] * $servings, 1),
            'carbs' => round($per['carbs'] * $servings, 1),
            'protein' => round($per['protein'] * $servings, 1),
            'fat' => round($per['fat'] * $servings, 1),
            'sodium' => round($per['sodium'] * $servings, 1),
            'fiber' => round($per['fiber'] * $servings, 1),
        ]);

        return $this;
    }

    /** Recalcula o snapshot a partir de um alimento + quantidade (+ porção opcional). */
    public function fillFromFood(Food $food, float $quantity, ?FoodPortion $portion): static
    {
        $amount = $portion ? $quantity * $portion->qty : $quantity;
        $unit = $portion
            ? sprintf('%s (%s %s)', $portion->label, rtrim(rtrim(number_format($portion->qty, 1, ',', ''), '0'), ','), $food->base_unit)
            : $food->base_unit;

        $this->fill([
            'food_id' => $food->id,
            'portion_id' => $portion?->id,
            'name' => $food->label(),
            'brand' => $food->brand,
            'quantity' => $quantity,
            'unit_label' => $unit,
            'amount' => $amount,
            'base_unit' => $food->base_unit,
            ...$food->nutrientsFor($amount),
        ]);

        return $this;
    }
}
