<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Como o dia conta na meta de calorias:
     * max = até a meta (emagrecer) · range = perto da meta, ±10% (manter) · min = pelo menos a meta (ganhar massa).
     */
    public function up(): void
    {
        Schema::table('goals', function (Blueprint $table) {
            $table->string('kcal_mode', 5)->default('range')->after('kcal');
        });
    }

    public function down(): void
    {
        Schema::table('goals', function (Blueprint $table) {
            $table->dropColumn('kcal_mode');
        });
    }
};
