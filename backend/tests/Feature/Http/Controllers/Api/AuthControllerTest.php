<?php

namespace Tests\Feature\Http\Controllers\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class AuthControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_profile_update_saves_body_data_used_for_energy_estimate(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->putJson('/api/me', [
            'name' => $user->name, 'email' => $user->email, 'sex' => 'f', 'birth_date' => '1996-01-01', 'height_cm' => 165,
        ])
            ->assertOk()
            ->assertJsonPath('user.sex', 'f')
            ->assertJsonPath('user.birth_date', '1996-01-01')
            ->assertJsonPath('user.height_cm', 165);
    }

    public function test_profile_update_without_body_data_keeps_saved_values(): void
    {
        $user = User::factory()->create(['sex' => 'm', 'height_cm' => 180]);

        $this->actingAs($user)->putJson('/api/me', ['name' => 'Novo nome', 'email' => $user->email])->assertOk();

        $this->assertSame(180, $user->fresh()->height_cm);
    }

    /** @return array<string, array{string, mixed}> */
    public static function invalidBodyData(): array
    {
        return [
            'unknown sex' => ['sex', 'x'],
            'height in meters' => ['height_cm', 1.65],
            'height too low' => ['height_cm', 99],
            'height too high' => ['height_cm', 251],
            'birth date in the future' => ['birth_date', '2030-01-01'],
            'birth date with wrong format' => ['birth_date', '01/01/1996'],
        ];
    }

    #[DataProvider('invalidBodyData')]
    public function test_profile_update_rejects_invalid_body_data_with_422(string $field, mixed $value): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->putJson('/api/me', ['name' => $user->name, 'email' => $user->email, $field => $value])
            ->assertUnprocessable()
            ->assertJsonValidationErrors($field);
    }
}
