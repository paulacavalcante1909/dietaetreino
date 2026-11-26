<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Recipe extends Model
{
    use SoftDeletes;

    protected $fillable = ['name', 'servings'];

    protected $hidden = ['user_id', 'created_at', 'deleted_at'];

    protected function casts(): array
    {
        return ['servings' => 'float'];
    }

    public function items(): HasMany
    {
        return $this->hasMany(RecipeItem::class)->orderBy('position')->orderBy('id');
    }

    /**
     * Totais da receita inteira, calculados a partir dos alimentos atuais.
     * $items permite calcular com ingredientes ajustados (sem alterar a receita).
     */
    public function totals(?iterable $items = null): array
    {
        if ($items === null) {
            $this->loadMissing('items.food', 'items.portion');
            $items = $this->items;
        }
        $t = ['kcal' => 0, 'carbs' => 0, 'protein' => 0, 'fat' => 0, 'sodium' => 0, 'fiber' => 0, 'amount' => 0];
        foreach ($items as $item) {
            if (! $item->food) {
                continue;
            }
            $amount = $item->amount();
            foreach ($item->food->nutrientsFor($amount) as $k => $v) {
                $t[$k] += $v;
            }
            $t['amount'] += $amount;
        }

        return array_map(fn ($v) => round($v, 1), $t);
    }

    /** Valores de UMA porção (opcionalmente com ingredientes ajustados). */
    public function perServing(?iterable $items = null): array
    {
        $s = $this->servings > 0 ? $this->servings : 1;

        return array_map(fn ($v) => round($v / $s, 1), $this->totals($items));
    }

    public function summary(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'servings' => $this->servings,
            'items_count' => $this->items->count(),
            'per_serving' => $this->perServing(),
            'updated_at' => $this->updated_at,
        ];
    }
}
