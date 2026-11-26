<?php

namespace Tests\Feature\Http\Controllers\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
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

    public function test_body_update_saves_profile_and_todays_weight_and_returns_energy(): void
    {
        $this->travelTo('2026-11-25 12:00:00');
        $user = User::factory()->create();

        $this->actingAs($user)->putJson('/api/me/body', ['sex' => 'f', 'birth_date' => '1996-01-01', 'height_cm' => 165, 'weight_kg' => 65])
            ->assertOk()
            ->assertJsonPath('user.height_cm', 165)
            ->assertJsonPath('energy.available', true)
            ->assertJsonPath('energy.tmb', 1370);

        $this->assertDatabaseHas('weights', ['user_id' => $user->id, 'kg' => 65]);
    }

    public function test_body_update_without_weight_reports_weight_as_missing(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->putJson('/api/me/body', ['sex' => 'm', 'birth_date' => '1990-05-10', 'height_cm' => 180])
            ->assertOk()
            ->assertJsonPath('energy.missing', ['weight']);
    }

    public function test_body_update_rejects_implausible_weight_with_422(): void
    {
        $this->actingAs(User::factory()->create())->putJson('/api/me/body', ['weight_kg' => 5])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('weight_kg');
    }

    public function test_energy_requires_authentication_and_returns_401(): void
    {
        $this->getJson('/api/me/energy')->assertUnauthorized();
    }

    public function test_profile_photo_can_be_uploaded_viewed_by_signed_link_and_removed(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();

        $url = $this->actingAs($user)->post('/api/me/avatar', ['avatar' => UploadedFile::fake()->image('eu.jpg', 800, 600)], ['Accept' => 'application/json'])
            ->assertOk()->json('user.avatar_url');

        $this->assertNotNull($url);
        $this->get($url)->assertOk();
        $this->get('/api/users/'.$user->id.'/avatar')->assertForbidden();
        [$w, $h] = getimagesizefromstring(Storage::disk('local')->get($user->fresh()->avatar_path));
        $this->assertSame([512, 512], [$w, $h]);

        $this->actingAs($user)->deleteJson('/api/me/avatar')->assertOk()->assertJsonPath('user.avatar_url', null);
        $this->assertCount(0, Storage::disk('local')->allFiles());
    }
}
