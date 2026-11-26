<?php

namespace Tests\Feature\Http\Controllers\Api;

use App\Models\Checkin;
use App\Models\Food;
use App\Models\User;
use App\Models\Weight;
use App\Models\WorkoutSession;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class DayControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    private const TODAY = '2026-11-25';

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(self::TODAY.' 12:00:00');
    }

    public function test_energy_lists_missing_profile_fields_and_omits_deficit(): void
    {
        $user = User::factory()->create(['height_cm' => 165]);

        $this->actingAs($user)->getJson('/api/day/'.self::TODAY)
            ->assertOk()
            ->assertJsonPath('energy', ['available' => false, 'missing' => ['sex', 'birth_date', 'weight']]);
    }

    public function test_female_basal_rate_and_deficit_follow_mifflin_st_jeor(): void
    {
        $user = $this->profiledUser('f');
        $this->logFood($user, kcalPer100g: 124, fiberPer100g: 2.7, grams: 200);

        $energy = $this->actingAs($user)->getJson('/api/day/'.self::TODAY)->assertOk()->json('energy');

        // 10×65 + 6,25×165 − 5×30 − 161 = 1.370,25
        $this->assertSame(1370, $energy['tmb']);
        $this->assertSame(1.2, $energy['factor']);
        $this->assertSame(1644, $energy['get']);
        $this->assertSame(1644 - 248, $energy['deficit']);
    }

    public function test_male_basal_rate_adds_5_instead_of_subtracting_161(): void
    {
        $energy = $this->actingAs($this->profiledUser('m'))->getJson('/api/day/'.self::TODAY)->json('energy');

        $this->assertSame(1536, $energy['tmb']); // 1.370,25 + 166
    }

    public function test_deficit_is_negative_when_intake_exceeds_estimated_expenditure(): void
    {
        $user = $this->profiledUser('f');
        $this->logFood($user, kcalPer100g: 400, fiberPer100g: 0, grams: 500);

        $energy = $this->actingAs($user)->getJson('/api/day/'.self::TODAY)->json('energy');

        $this->assertSame(1644 - 2000, $energy['deficit']);
    }

    /** @return array<string, array{int, float, string}> */
    public static function checkinFrequencies(): array
    {
        return [
            'no check-ins' => [0, 1.2, 'Sedentário'],
            '1 per week' => [1, 1.375, 'Levemente ativo'],
            '3 per week' => [3, 1.55, 'Moderadamente ativo'],
            '5 per week' => [5, 1.725, 'Muito ativo'],
            'every day' => [7, 1.9, 'Extremamente ativo'],
        ];
    }

    #[DataProvider('checkinFrequencies')]
    public function test_activity_factor_follows_weekly_checkin_frequency(int $checkins, float $factor, string $level): void
    {
        $user = $this->profiledUser('f'); // conta nova: janela de 7 dias
        for ($i = 0; $i < $checkins; $i++) {
            $this->checkin($user, now()->subDays($i)->toDateString());
        }

        $energy = $this->actingAs($user)->getJson('/api/day/'.self::TODAY)->json('energy');

        $this->assertSame($factor, $energy['factor']);
        $this->assertSame($level, $energy['level']);
        $this->assertSame((int) round(1370.25 * $factor), $energy['get']);
    }

    public function test_activity_window_spans_four_weeks_for_older_accounts(): void
    {
        $user = $this->profiledUser('f', createdDaysAgo: 90);
        foreach ([1, 8, 15, 22, 40] as $daysAgo) { // o de 40 dias atrás fica fora da janela
            $this->checkin($user, now()->subDays($daysAgo)->toDateString());
        }

        $energy = $this->actingAs($user)->getJson('/api/day/'.self::TODAY)->json('energy');

        $this->assertSame(28, $energy['window_days']);
        $this->assertSame(1.0, (float) $energy['checkins_per_week']); // o JSON envia 1.0 como 1
        $this->assertSame(1.375, $energy['factor']);
    }

    public function test_activity_factor_counts_workouts_done_in_app_without_checkin(): void
    {
        $user = $this->profiledUser('f');
        foreach ([0, 1, 2] as $daysAgo) {
            WorkoutSession::forceCreate([
                'user_id' => $user->id, 'workout_name' => 'Treino A', 'date' => now()->subDays($daysAgo)->toDateString(),
                'started_at' => now(), 'finished_at' => now(), 'duration_seconds' => 3600, 'exercises' => [], 'kcal_burned' => 300,
            ]);
        }

        $energy = $this->actingAs($user)->getJson('/api/day/'.self::TODAY)->json('energy');

        $this->assertSame(1.55, $energy['factor']);
    }

    public function test_uses_latest_weight_recorded_up_to_the_requested_day(): void
    {
        $user = $this->profiledUser('f');
        Weight::forceCreate(['user_id' => $user->id, 'date' => '2026-11-26', 'kg' => 90]); // depois do dia pedido

        $energy = $this->actingAs($user)->getJson('/api/day/'.self::TODAY)->json('energy');

        $this->assertSame(65.0, (float) $energy['weight']);
    }

    public function test_day_totals_include_fiber(): void
    {
        $user = $this->profiledUser('f');
        $this->logFood($user, kcalPer100g: 124, fiberPer100g: 2.7, grams: 200);

        $this->actingAs($user)->getJson('/api/day/'.self::TODAY)
            ->assertJsonPath('totals.fiber', 5.4);
    }

    private function profiledUser(string $sex, int $createdDaysAgo = 0): User
    {
        $user = User::factory()->create([
            'sex' => $sex,
            'birth_date' => '1996-01-01',
            'height_cm' => 165,
            'created_at' => now()->subDays($createdDaysAgo),
        ]);
        Weight::forceCreate(['user_id' => $user->id, 'date' => '2026-11-20', 'kg' => 65]);

        return $user;
    }

    private function logFood(User $user, float $kcalPer100g, float $fiberPer100g, float $grams): void
    {
        $food = Food::forceCreate([
            'source' => 'taco', 'name' => 'Alimento teste', 'search_name' => 'alimento teste', 'base_qty' => 100, 'base_unit' => 'g',
            'kcal' => $kcalPer100g, 'carbs' => 0, 'protein' => 0, 'fat' => 0, 'sodium' => 0, 'fiber' => $fiberPer100g,
        ]);

        $this->actingAs($user)->postJson('/api/entries', [
            'date' => self::TODAY, 'meal_id' => $user->meals()->value('id'), 'food_id' => $food->id, 'quantity' => $grams,
        ])->assertCreated();
    }

    private function checkin(User $user, string $date): void
    {
        Checkin::forceCreate(['user_id' => $user->id, 'date' => $date, 'workout_name' => 'Treino A']);
    }
}
