<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Meal extends Model
{
    public const DEFAULTS = ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia'];

    protected $fillable = ['name', 'position', 'active'];

    protected $hidden = ['user_id', 'created_at', 'updated_at'];

    protected function casts(): array
    {
        return ['active' => 'boolean', 'position' => 'integer'];
    }

    public function entries(): HasMany
    {
        return $this->hasMany(DiaryEntry::class);
    }
}
