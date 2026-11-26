<?php

use App\Models\Meal;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Horário de cada refeição ("07:00"): escolhe a refeição do momento ao registrar. */
    public function up(): void
    {
        Schema::table('meals', function (Blueprint $table) {
            $table->string('time', 5)->nullable()->after('position');
        });

        // Refeições padrão já criadas ganham o horário padrão
        foreach (Meal::TIMES as $name => $time) {
            DB::table('meals')->where('name', $name)->whereNull('time')->update(['time' => $time]);
        }
    }

    public function down(): void
    {
        Schema::table('meals', function (Blueprint $table) {
            $table->dropColumn('time');
        });
    }
};
